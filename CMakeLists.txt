cmake_minimum_required(VERSION 3.22)

project(VictorZynth VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

option(AETHERWAVE_WEB_DEV_SERVER "Load the React UI from http://localhost:3000 instead of embedded resources" OFF)

include(FetchContent)
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 9.0.2
    GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(JUCE)

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
)

target_include_directories(VictorZynth PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/plugin)

target_compile_definitions(VictorZynth
    PUBLIC
        JUCE_USE_CURL=0
    PRIVATE
        AETHERWAVE_WEB_DEV_SERVER=$<BOOL:${AETHERWAVE_WEB_DEV_SERVER}>
        $<$<PLATFORM_ID:Windows>:JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1>
)

target_link_libraries(VictorZynth
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
        juce::juce_gui_extra
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)
