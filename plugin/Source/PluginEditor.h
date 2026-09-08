#pragma once

#include "PluginProcessor.h"

#include <juce_gui_extra/juce_gui_extra.h>

class VictorZynthAudioProcessorEditor final : public juce::AudioProcessorEditor
{
public:
    explicit VictorZynthAudioProcessorEditor(VictorZynthAudioProcessor&);
    ~VictorZynthAudioProcessorEditor() override = default;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    class RestrictedBrowser final : public juce::WebBrowserComponent
    {
    public:
        using juce::WebBrowserComponent::WebBrowserComponent;
        bool pageAboutToLoad(const juce::String& newURL) override;
    };

    static juce::WebBrowserComponent::Options makeBrowserOptions(VictorZynthAudioProcessor&);
    static std::optional<juce::WebBrowserComponent::Resource> getResource(const juce::String& url);

    VictorZynthAudioProcessor& processor;
    RestrictedBrowser browser;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VictorZynthAudioProcessorEditor)
};
