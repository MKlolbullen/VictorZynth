#include "PluginEditor.h"

#include "AetherWaveWebAssets.h"

#include <cmath>
#include <cstring>

namespace
{
const juce::String devServerAddress { "http://localhost:3000/" };

std::vector<std::byte> toBytes(const void* data, int size)
{
    if (data == nullptr || size <= 0)
        return {};

    std::vector<std::byte> bytes(static_cast<std::size_t>(size));
    std::memcpy(bytes.data(), data, static_cast<std::size_t>(size));
    return bytes;
}

std::optional<juce::WebBrowserComponent::Resource> namedResource(const char* name, const char* mime)
{
    int size = 0;
    if (const auto* data = AetherWaveWebAssets::getNamedResource(name, size))
        return juce::WebBrowserComponent::Resource { toBytes(data, size), mime };
    return std::nullopt;
}

juce::var parameterSnapshot(VictorZynthAudioProcessor& processor)
{
    auto* object = new juce::DynamicObject();
    for (auto* parameter : processor.getParameters())
    {
        auto* ranged = dynamic_cast<juce::RangedAudioParameter*>(parameter);
        auto* withID = dynamic_cast<juce::AudioProcessorParameterWithID*>(parameter);
        if (ranged != nullptr && withID != nullptr)
            object->setProperty(withID->paramID, ranged->convertFrom0to1(ranged->getValue()));
    }
    return juce::var(object);
}
}

juce::WebBrowserComponent::Options
VictorZynthAudioProcessorEditor::makeBrowserOptions(VictorZynthAudioProcessor& processor)
{
    auto options = juce::WebBrowserComponent::Options{}
        .withNativeIntegrationEnabled()
        .withNativeFunction("getParameter", [&processor](const auto& args, auto complete)
        {
            if (args.isEmpty())
            {
                complete(juce::var());
                return;
            }

            if (auto* parameter = processor.getValueTreeState().getParameter(args[0].toString()))
            {
                complete(parameter->convertFrom0to1(parameter->getValue()));
                return;
            }
            complete(juce::var());
        })
        .withNativeFunction("getParameterSnapshot", [&processor](const auto&, auto complete)
        {
            complete(parameterSnapshot(processor));
        })
        .withNativeFunction("setParameter", [&processor](const auto& args, auto complete)
        {
            if (args.size() < 2)
            {
                complete(false);
                return;
            }

            if (auto* parameter = processor.getValueTreeState().getParameter(args[0].toString()))
            {
                const auto actual = static_cast<float>(static_cast<double>(args[1]));
                parameter->setValueNotifyingHost(parameter->convertTo0to1(actual));
                complete(true);
                return;
            }
            complete(false);
        })
        .withNativeFunction("beginParameterGesture", [&processor](const auto& args, auto complete)
        {
            if (! args.isEmpty())
                if (auto* parameter = processor.getValueTreeState().getParameter(args[0].toString()))
                    parameter->beginChangeGesture();
            complete(juce::var());
        })
        .withNativeFunction("endParameterGesture", [&processor](const auto& args, auto complete)
        {
            if (! args.isEmpty())
                if (auto* parameter = processor.getValueTreeState().getParameter(args[0].toString()))
                    parameter->endChangeGesture();
            complete(juce::var());
        })
        .withNativeFunction("noteOn", [&processor](const auto& args, auto complete)
        {
            if (args.size() >= 2)
            {
                const auto note = juce::jlimit(0, 127, static_cast<int>(args[0]));
                const auto velocity = juce::jlimit(0.0f, 1.0f, static_cast<float>(static_cast<double>(args[1])));
                processor.queueMidiMessage(juce::MidiMessage::noteOn(1, note, velocity));
            }
            complete(juce::var());
        })
        .withNativeFunction("noteOff", [&processor](const auto& args, auto complete)
        {
            if (! args.isEmpty())
            {
                const auto note = juce::jlimit(0, 127, static_cast<int>(args[0]));
                processor.queueMidiMessage(juce::MidiMessage::noteOff(1, note));
            }
            complete(juce::var());
        })
        .withNativeFunction("allNotesOff", [&processor](const auto&, auto complete)
        {
            processor.queueMidiMessage(juce::MidiMessage::allNotesOff(1));
            processor.queueMidiMessage(juce::MidiMessage::allSoundOff(1));
            complete(juce::var());
        })
        .withNativeFunction("setPitchBend", [&processor](const auto& args, auto complete)
        {
            if (! args.isEmpty())
            {
                const auto value = juce::jlimit(-1.0, 1.0, static_cast<double>(args[0]));
                const auto wheel = juce::jlimit(0, 16383, static_cast<int>(std::lround((value + 1.0) * 8191.5)));
                processor.queueMidiMessage(juce::MidiMessage::pitchWheel(1, wheel));
            }
            complete(juce::var());
        })
        .withNativeFunction("setModWheel", [&processor](const auto& args, auto complete)
        {
            if (! args.isEmpty())
            {
                const auto value = juce::jlimit(0.0, 1.0, static_cast<double>(args[0]));
                processor.queueMidiMessage(juce::MidiMessage::controllerEvent(1, 1, static_cast<int>(std::lround(value * 127.0))));
            }
            complete(juce::var());
        })
        .withNativeFunction("setModMatrix", [&processor](const auto& args, auto complete)
        {
            if (! args.isEmpty())
                processor.setModMatrixJson(args[0].toString());
            complete(juce::var());
        })
        .withNativeFunction("setAuxState", [&processor](const auto& args, auto complete)
        {
            if (! args.isEmpty())
                processor.setAuxStateJson(args[0].toString());
            complete(juce::var());
        })
        .withNativeFunction("getTelemetry", [&processor](const auto&, auto complete)
        {
            complete(processor.getTelemetry());
        })
        .withNativeFunction("getStudioTelemetry", [&processor](const auto&, auto complete)
        {
            complete(processor.getStudioTelemetry());
        })
        .withNativeFunction("getPerformanceTelemetry", [&processor](const auto&, auto complete)
        {
            complete(processor.getPerformanceTelemetry());
        })
        .withNativeFunction("getPerformanceSettings", [&processor](const auto&, auto complete)
        {
            complete(processor.getPerformanceSettings());
        })
        .withNativeFunction("setPerformanceSettings", [&processor](const auto& args, auto complete)
        {
            if (! args.isEmpty())
                processor.setPerformanceSettings(args[0]);
            complete(true);
        })
        .withNativeFunction("getHostInfo", [&processor](const auto&, auto complete)
        {
            complete(processor.getHostInfo());
        })
        .withNativeFunction("getAISettings", [&processor](const auto&, auto complete)
        {
            complete(processor.getAISettings());
        })
        .withNativeFunction("setAISettings", [&processor](const auto& args, auto complete)
        {
            if (! args.isEmpty())
                processor.setAISettings(args[0]);
            complete(true);
        })
        .withNativeFunction("startMidiGeneration", [&processor](const auto& args, auto complete)
        {
            complete(! args.isEmpty() && processor.startMidiGeneration(args[0]));
        })
        .withNativeFunction("getMidiGeneratorState", [&processor](const auto&, auto complete)
        {
            complete(processor.getMidiGeneratorState());
        })
        .withNativeFunction("listMidiLibrary", [&processor](const auto&, auto complete)
        {
            complete(processor.listMidiLibrary());
        })
        .withNativeFunction("revealMidiLibrary", [&processor](const auto&, auto complete)
        {
            processor.revealMidiLibrary();
            complete(true);
        })
        .withResourceProvider([](const auto& url)
        {
            return VictorZynthAudioProcessorEditor::getResource(url);
        });

   #if JUCE_WINDOWS
    options = options
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
        .withWinWebView2Options(juce::WebBrowserComponent::Options::WinWebView2{}
            .withUserDataFolder(juce::File::getSpecialLocation(juce::File::SpecialLocationType::tempDirectory)
                .getChildFile("VictorZynth-WebView2")));
   #endif

    return options;
}

std::optional<juce::WebBrowserComponent::Resource>
VictorZynthAudioProcessorEditor::getResource(const juce::String& rawUrl)
{
    auto url = rawUrl.upToFirstOccurrenceOf("?", false, false);
    if (url.isEmpty() || url == "/" || url.endsWith("index.html"))
        return namedResource("index_html", "text/html; charset=utf-8");
    if (url.endsWith("/assets/app.js"))
        return namedResource("app_js", "text/javascript; charset=utf-8");
    if (url.endsWith("/assets/style.css"))
        return namedResource("style_css", "text/css; charset=utf-8");
    return std::nullopt;
}

bool VictorZynthAudioProcessorEditor::RestrictedBrowser::pageAboutToLoad(const juce::String& newURL)
{
    return newURL.startsWith(devServerAddress)
        || newURL.startsWith(juce::WebBrowserComponent::getResourceProviderRoot());
}

VictorZynthAudioProcessorEditor::VictorZynthAudioProcessorEditor(VictorZynthAudioProcessor& p)
    : AudioProcessorEditor(&p), processor(p), browser(makeBrowserOptions(p))
{
    addAndMakeVisible(browser);
    setResizable(true, true);
    setResizeLimits(900, 600, 2200, 1400);
    setSize(1440, 900);

   #if AETHERWAVE_WEB_DEV_SERVER
    browser.goToURL(devServerAddress);
   #else
    browser.goToURL(juce::WebBrowserComponent::getResourceProviderRoot());
   #endif
}

void VictorZynthAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff070b14));
}

void VictorZynthAudioProcessorEditor::resized()
{
    browser.setBounds(getLocalBounds());
}
