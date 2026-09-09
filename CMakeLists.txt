cmake_minimum_required(VERSION 3.22)

project(VictorZynth VERSION 0.2.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

option(AETHERWAVE_WEB_DEV_SERVER "Load the React UI from http://localhost:3000 instead of embedded resources" OFF)
option(AETHERWAVE_BUILD_WEB_UI "Build the React UI during CMake configure for embedding in the plugin" ON)

include(FetchContent)
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 9.0.2
    GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(JUCE)

set(AETHERWAVE_WEB_DIST "${CMAKE_CURRENT_SOURCE_DIR}/plugin/WebUI/dist")
set(AETHERWAVE_WEB_INDEX "${AETHERWAVE_WEB_DIST}/index.html")
set(AETHERWAVE_WEB_JS "${AETHERWAVE_WEB_DIST}/assets/app.js")
set(AETHERWAVE_WEB_CSS "${AETHERWAVE_WEB_DIST}/assets/style.css")

if(AETHERWAVE_BUILD_WEB_UI)
    find_program(NPM_EXECUTABLE npm REQUIRED)

    if(NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/node_modules/.bin/vite")
        message(STATUS "Installing frontend dependencies for embedded AetherWave UI")
        execute_process(
            COMMAND "${NPM_EXECUTABLE}" install --no-audit --no-fund
            WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
            COMMAND_ERROR_IS_FATAL ANY
        )
    endif()

    message(STATUS "Building embedded AetherWave React UI")
    execute_process(
        COMMAND "${NPM_EXECUTABLE}" run build -- --mode plugin
        WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
        COMMAND_ERROR_IS_FATAL ANY
    )
endif()

foreach(asset IN ITEMS "${AETHERWAVE_WEB_INDEX}" "${AETHERWAVE_WEB_JS}" "${AETHERWAVE_WEB_CSS}")
    if(NOT EXISTS "${asset}")
        message(FATAL_ERROR "Missing embedded UI asset: ${asset}. Run 'npm run build -- --mode plugin' or enable AETHERWAVE_BUILD_WEB_UI.")
    endif()
endforeach()

juce_add_binary_data(AetherWaveWebAssets
    HEADER_NAME AetherWaveWebAssets.h
    NAMESPACE AetherWaveWebAssets
    SOURCES
        "${AETHERWAVE_WEB_INDEX}"
        "${AETHERWAVE_WEB_JS}"
        "${AETHERWAVE_WEB_CSS}"
)

juce_add_plugin(VictorZynth
    COMPANY_NAME "VictorZynth"
    BUNDLE_ID "com.victorzynth.aetherwave"
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD FALSE
    NEEDS_WEB_BROWSER TRUE
    NEEDS_WEBVIEW2 TRUE
    PLUGIN_MANUFACTURER_CODE Vzyn
    PLUGIN_CODE Aewa
    FORMATS VST3 Standalone
    PRODUCT_NAME "AetherWave"
    PLUGIN_NAME "AetherWave"
    VST3_CATEGORIES Instrument Synth
)

target_sources(VictorZynth
    PRIVATE
        plugin/Source/PluginProcessor.cpp
        plugin/Source/PluginProcessor.h
        plugin/Source/PluginEditor.cpp
        plugin/Source/PluginEditor.h
        plugin/Parameters/Parameters.cpp
        plugin/Parameters/Parameters.h
        plugin/DSP/WavetableBank.cpp
        plugin/DSP/WavetableBank.h
        plugin/DSP/WavetableVoice.cpp
        plugin/DSP/WavetableVoice.h
        plugin/DSP/ModulationEngine.cpp
        plugin/DSP/ModulationEngine.h
        plugin/DSP/EffectsChain.cpp
        plugin/DSP/EffectsChain.h
)

target_include_directories(VictorZynth PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/plugin)

target_compile_definitions(VictorZynth
    PUBLIC
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
    PRIVATE
        AETHERWAVE_WEB_DEV_SERVER=$<BOOL:${AETHERWAVE_WEB_DEV_SERVER}>
        $<$<PLATFORM_ID:Windows>:JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1>
)

target_link_libraries(VictorZynth
    PRIVATE
        AetherWaveWebAssets
        juce::juce_audio_utils
        juce::juce_dsp
        juce::juce_gui_extra
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)
