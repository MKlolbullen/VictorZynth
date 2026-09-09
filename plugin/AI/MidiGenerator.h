#pragma once

#include <functional>
#include <juce_audio_utils/juce_audio_utils.h>
#include <vector>

namespace aetherwave::ai
{
struct GeneratedNote
{
    int pitch = 60;
    double startBeats = 0.0;
    double lengthBeats = 1.0;
    int velocity = 90;
};

struct GeneratedTrack
{
    juce::String name;
    juce::String instrument;
    int gmProgram = 0;
    bool isDrums = false;
    std::vector<GeneratedNote> notes;
};

class MidiGenerator final : private juce::Thread
{
public:
    struct Request
    {
        bool useAnthropic = true;
        bool multiTrack = false;
        juce::String endpoint;
        juce::String model;
        juce::String apiKey;
        juce::String prompt;
    };

    struct Result
    {
        bool success = false;
        juce::String message;
        std::vector<GeneratedNote> notes;
        std::vector<GeneratedTrack> tracks;
        double tempoBpm = 120.0;
    };

    MidiGenerator() : Thread("VictorZynthMidiGenerator") {}
    ~MidiGenerator() override { stopThread(15000); }

    bool isBusy() const { return isThreadRunning(); }
    void generate(Request newRequest, std::function<void(Result)> callback);

    static std::vector<GeneratedNote> humanize(const std::vector<GeneratedNote>& notes,
                                                float amount01, juce::int64 seed);
    static bool writeMidiFile(const std::vector<GeneratedNote>& notes,
                              double tempoBpm,
                              float humanizeAmount01,
                              juce::int64 seed,
                              const juce::File& target,
                              int midiChannel = 1,
                              int gmProgram = -1);
    static bool writeMultiTrackFile(const std::vector<GeneratedTrack>& tracks,
                                    double tempoBpm,
                                    const juce::File& target);
    static bool loadMidiFile(const juce::File& source,
                             std::vector<GeneratedNote>& notes,
                             double& tempoBpm);
    static juce::String notesToJson(const std::vector<GeneratedNote>& notes,
                                    double tempoBpm,
                                    int maxNotes = 200);
    static juce::String tracksToJson(const std::vector<GeneratedTrack>& tracks,
                                     double tempoBpm,
                                     int maxNotesPerTrack = 120);

private:
    void run() override;
    Result performRequest() const;
    Result parseModelOutput(const juce::String& text) const;
    static juce::String extractJsonObject(const juce::String& text);

    Request request;
    std::function<void(Result)> onDone;
};
}
