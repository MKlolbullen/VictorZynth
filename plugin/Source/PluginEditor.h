#pragma once

#include "PluginProcessor.h"

#include <juce_gui_extra/juce_gui_extra.h>

class VictorZynthAudioProcessorEditor final : public juce::AudioProcessorEditor,
                                             private juce::Timer
{
public:
    explicit VictorZynthAudioProcessorEditor(VictorZynthAudioProcessor&);
    ~VictorZynthAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    class RestrictedBrowser final : public juce::WebBrowserComponent
    {
    public:
        using juce::WebBrowserComponent::WebBrowserComponent;
        bool pageAboutToLoad(const juce::String& newURL) override;
        bool pageLoadHadNetworkError(const juce::String& error) override;
        std::function<void(const juce::String&)> onLoadError;
    };

    static juce::WebBrowserComponent::Options makeBrowserOptions(VictorZynthAudioProcessor&);
    static std::optional<juce::WebBrowserComponent::Resource> getResource(const juce::String& url);
    void restartBrowser();
    void timerCallback() override;
    void showFallback(const juce::String& reason);
    void reportUi(const juce::String& status, const juce::String& detail);

    VictorZynthAudioProcessor& processor;
    std::unique_ptr<RestrictedBrowser> browser;
    std::unique_ptr<juce::GenericAudioProcessorEditor> fallback;
    juce::Label statusLabel;
    juce::TextButton retryButton { "Retry full interface" };
    juce::uint32 startupTime = 0;
    int browserGeneration = 0;
    bool evaluationPending = false;
    juce::String lastProbe;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VictorZynthAudioProcessorEditor)
};
