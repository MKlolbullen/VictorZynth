#include "PluginEditor.h"

#include <cstring>

namespace
{
const juce::String devServerAddress { "http://localhost:3000/" };

std::vector<std::byte> toBytes(const juce::String& text)
{
    const auto size = static_cast<std::size_t>(text.getNumBytesAsUTF8());
    std::vector<std::byte> bytes(size);
    std::memcpy(bytes.data(), text.toRawUTF8(), size);
    return bytes;
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
VictorZynthAudioProcessorEditor::getResource(const juce::String& url)
{
    if (url != "/" && ! url.endsWith("index.html"))
        return std::nullopt;

    const juce::String html = R"HTML(
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>AetherWave</title>
<style>
html,body{height:100%;margin:0;background:#070b14;color:#dbeafe;font-family:Inter,system-ui,sans-serif}
main{height:100%;display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,#13233d 0,#070b14 55%)}
section{max-width:760px;padding:40px;border:1px solid #263b5d;border-radius:20px;background:#0b1220dd;box-shadow:0 30px 80px #0008}
h1{margin:0 0 8px;font-size:42px;letter-spacing:.04em}.accent{color:#67e8f9}p{line-height:1.65;color:#9fb4d0}code{color:#a7f3d0}
.status{display:inline-block;margin-top:12px;padding:8px 12px;border:1px solid #1d4ed8;border-radius:999px;color:#93c5fd}
</style>
</head>
<body><main><section>
<h1>Aether<span class="accent">Wave</span> native core</h1>
<p>The JUCE/VST3 processor is running. This fallback page is embedded in the plugin so release builds never depend on an external web server.</p>
<p>For React UI development configure CMake with <code>-DAETHERWAVE_WEB_DEV_SERVER=ON</code> and run <code>npm run dev</code>.</p>
<div class="status">VST3 + Standalone · native MIDI/DSP online</div>
</section></main></body>
</html>)HTML";

    return juce::WebBrowserComponent::Resource { toBytes(html), "text/html" };
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
