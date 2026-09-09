#include "MidiGenerator.h"

namespace aetherwave::ai
{
namespace
{
constexpr auto kSystemPrompt =
    "You are a MIDI composer embedded in an audio plugin. Reply with ONLY a JSON object - "
    "no markdown fences, no commentary - of the form: "
    "{\"tempoBpm\": <number>, \"notes\": [{\"pitch\": <0-127>, \"startBeats\": <number>, "
    "\"lengthBeats\": <number>, \"velocity\": <1-127>}, ...]}. "
    "startBeats and lengthBeats are measured in quarter-note beats from the start of the clip. "
    "Compose musically coherent material that matches the user's request (harmony, voice "
    "leading, rhythm and phrasing all matter). Use at most 400 notes.";

constexpr auto kOutputFormat = R"json(
{
  "type": "json_schema",
  "schema": {
    "type": "object",
    "properties": {
      "tempoBpm": { "type": "number" },
      "notes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "pitch":       { "type": "integer" },
            "startBeats":  { "type": "number" },
            "lengthBeats": { "type": "number" },
            "velocity":    { "type": "integer" }
          },
          "required": ["pitch", "startBeats", "lengthBeats", "velocity"],
          "additionalProperties": false
        }
      }
    },
    "required": ["tempoBpm", "notes"],
    "additionalProperties": false
  }
})json";

constexpr auto kMultiTrackSystemPrompt =
    "You are a MIDI arranger embedded in an audio plugin. Reply with ONLY a JSON object - "
    "no markdown fences, no commentary - of the form: "
    "{\"tempoBpm\": <number>, \"tracks\": [{\"name\": <string>, \"instrument\": <string>, "
    "\"gmProgram\": <0-127>, \"isDrums\": <bool>, \"notes\": [{\"pitch\": <0-127>, "
    "\"startBeats\": <number>, \"lengthBeats\": <number>, \"velocity\": <1-127>}, ...]}, ...]}. "
    "startBeats and lengthBeats are in quarter-note beats. Produce a coherent arrangement of "
    "typically 3-5 tracks (e.g. drums, bass, chords or picking, melody) unless the user asks "
    "otherwise. Drum tracks: set isDrums true and use General MIDI drum-map pitches (36 kick, "
    "38 snare, 42 closed hat, 46 open hat, ...). Pitched tracks: set a fitting General MIDI "
    "gmProgram (33 fingered bass, 25 steel guitar, 0 piano, 80 lead, 48 strings). All tracks "
    "must share one key and groove and interlock rhythmically. Use at most 300 notes per track.";

constexpr auto kMultiTrackOutputFormat = R"json(
{
  "type": "json_schema",
  "schema": {
    "type": "object",
    "properties": {
      "tempoBpm": { "type": "number" },
      "tracks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name":       { "type": "string" },
            "instrument": { "type": "string" },
            "gmProgram":  { "type": "integer" },
            "isDrums":    { "type": "boolean" },
            "notes": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "pitch":       { "type": "integer" },
                  "startBeats":  { "type": "number" },
                  "lengthBeats": { "type": "number" },
                  "velocity":    { "type": "integer" }
                },
                "required": ["pitch", "startBeats", "lengthBeats", "velocity"],
                "additionalProperties": false
              }
            }
          },
          "required": ["name", "instrument", "gmProgram", "isDrums", "notes"],
          "additionalProperties": false
        }
      }
    },
    "required": ["tempoBpm", "tracks"],
    "additionalProperties": false
  }
})json";

juce::var makeObject(std::initializer_list<std::pair<juce::Identifier, juce::var>> fields)
{
    auto* obj = new juce::DynamicObject();
    for (const auto& [name, value] : fields)
        obj->setProperty(name, value);
    return juce::var(obj);
}

std::vector<GeneratedNote> parseNotes(const juce::var& notesVar, size_t maxNotes)
{
    std::vector<GeneratedNote> notes;
    if (const auto* array = notesVar.getArray())
    {
        for (const auto& n : *array)
        {
            GeneratedNote note;
            note.pitch = juce::jlimit(0, 127, int(n["pitch"]));
            note.velocity = juce::jlimit(1, 127, int(n.getProperty("velocity", 90)));
            note.startBeats = juce::jmax(0.0, double(n["startBeats"]));
            note.lengthBeats = juce::jlimit(0.01, 64.0, double(n.getProperty("lengthBeats", 1.0)));
            notes.push_back(note);
            if (notes.size() >= maxNotes)
                break;
        }
    }
    return notes;
}
}

void MidiGenerator::generate(Request newRequest, std::function<void(Result)> callback)
{
    if (isThreadRunning())
        return;

    request = std::move(newRequest);
    onDone = std::move(callback);
    startThread();
}

void MidiGenerator::run()
{
    auto result = performRequest();
    juce::MessageManager::callAsync([callback = onDone, result]
    {
        if (callback)
            callback(result);
    });
}

MidiGenerator::Result MidiGenerator::performRequest() const
{
    juce::String body, headers;
    const auto systemPrompt = juce::String(request.multiTrack ? kMultiTrackSystemPrompt : kSystemPrompt);
    const auto outputFormat = request.multiTrack ? kMultiTrackOutputFormat : kOutputFormat;

    if (request.useAnthropic)
    {
        body = juce::JSON::toString(makeObject({
            { "model", request.model },
            { "max_tokens", 32000 },
            { "system", systemPrompt },
            { "messages", juce::var(juce::Array<juce::var>{
                makeObject({ { "role", "user" }, { "content", request.prompt } }) }) },
            { "output_config", makeObject({ { "format", juce::JSON::parse(outputFormat) } }) },
        }));
        headers = "Content-Type: application/json\r\n"
                  "x-api-key: " + request.apiKey + "\r\n"
                  "anthropic-version: 2023-06-01\r\n";
    }
    else
    {
        body = juce::JSON::toString(makeObject({
            { "model", request.model },
            { "max_tokens", 32000 },
            { "messages", juce::var(juce::Array<juce::var>{
                makeObject({ { "role", "system" }, { "content", systemPrompt } }),
                makeObject({ { "role", "user" }, { "content", request.prompt } }) }) },
        }));
        headers = "Content-Type: application/json\r\n"
                  "Authorization: Bearer " + request.apiKey + "\r\n";
    }

    int statusCode = 0;
    auto stream = juce::URL(request.endpoint)
        .withPOSTData(body)
        .createInputStream(juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inPostData)
            .withExtraHeaders(headers)
            .withConnectionTimeoutMs(120000)
            .withStatusCode(&statusCode));

    if (stream == nullptr)
        return { false, "Could not connect to " + request.endpoint, {}, {}, 0.0 };

    const auto responseText = stream->readEntireStreamAsString();
    const auto response = juce::JSON::parse(responseText);

    if (statusCode >= 400 || response.hasProperty("error"))
    {
        auto errorMessage = response["error"]["message"].toString();
        if (errorMessage.isEmpty())
            errorMessage = responseText.substring(0, 300);
        return { false, "API error (" + juce::String(statusCode) + "): " + errorMessage, {}, {}, 0.0 };
    }

    juce::String text;
    if (request.useAnthropic)
    {
        if (response["stop_reason"].toString() == "refusal")
            return { false, "The model declined this request.", {}, {}, 0.0 };

        if (const auto* content = response["content"].getArray())
            for (const auto& block : *content)
                if (block["type"].toString() == "text")
                    text += block["text"].toString();
    }
    else
    {
        if (const auto* choices = response["choices"].getArray(); choices != nullptr && ! choices->isEmpty())
            text = (*choices)[0]["message"]["content"].toString();
    }

    if (text.isEmpty())
        return { false, "Empty response from the model.", {}, {}, 0.0 };

    return parseModelOutput(text);
}

juce::String MidiGenerator::extractJsonObject(const juce::String& text)
{
    const auto start = text.indexOfChar('{');
    const auto end = text.lastIndexOfChar('}');
    if (start < 0 || end <= start)
        return {};
    return text.substring(start, end + 1);
}

MidiGenerator::Result MidiGenerator::parseModelOutput(const juce::String& text) const
{
    const auto parsed = juce::JSON::parse(extractJsonObject(text));

    Result result;
    result.tempoBpm = juce::jlimit(20.0, 300.0, double(parsed.getProperty("tempoBpm", 120.0)));

    if (request.multiTrack)
    {
        const auto* tracksArray = parsed["tracks"].getArray();
        if (tracksArray == nullptr || tracksArray->isEmpty())
            return { false, "Could not parse tracks from the model's response.", {}, {}, 0.0 };

        for (const auto& t : *tracksArray)
        {
            GeneratedTrack track;
            track.name = t["name"].toString().substring(0, 40);
            track.instrument = t["instrument"].toString().substring(0, 40);
            track.gmProgram = juce::jlimit(0, 127, int(t.getProperty("gmProgram", 0)));
            track.isDrums = bool(t.getProperty("isDrums", false));
            track.notes = parseNotes(t["notes"], 1000);

            if (! track.notes.empty())
                result.tracks.push_back(std::move(track));
            if (result.tracks.size() >= 8)
                break;
        }

        if (result.tracks.empty())
            return { false, "The model returned no usable tracks.", {}, {}, 0.0 };

        result.success = true;
        result.message = juce::String(result.tracks.size()) + " tracks at "
                       + juce::String(result.tempoBpm, 1) + " BPM";
        return result;
    }

    result.notes = parseNotes(parsed["notes"], 1000);
    if (result.notes.empty())
        return { false, "Could not parse notes from the model's response.", {}, {}, 0.0 };

    result.success = true;
    result.message = juce::String(result.notes.size()) + " notes at "
                   + juce::String(result.tempoBpm, 1) + " BPM";
    return result;
}

std::vector<GeneratedNote> MidiGenerator::humanize(const std::vector<GeneratedNote>& notes,
                                                    float amount01, juce::int64 seed)
{
    if (amount01 <= 0.001f)
        return notes;

    juce::Random rng(seed);
    auto out = notes;
    for (auto& note : out)
    {
        note.startBeats = juce::jmax(0.0, note.startBeats
            + (rng.nextDouble() * 2.0 - 1.0) * 0.04 * amount01);
        note.lengthBeats = juce::jlimit(0.05, 64.0, note.lengthBeats
            * (1.0 + (rng.nextDouble() * 2.0 - 1.0) * 0.25 * amount01));
        note.velocity = juce::jlimit(1, 127, note.velocity
            + juce::roundToInt((rng.nextFloat() * 2.0f - 1.0f) * 14.0f * amount01));
    }
    return out;
}

namespace
{
juce::MidiMessageSequence buildSequence(const std::vector<GeneratedNote>& notes,
                                         float humanizeAmount01, juce::int64 seed,
                                         int midiChannel, int gmProgram)
{
    juce::MidiMessageSequence sequence;

    if (gmProgram >= 0 && midiChannel != 10)
        sequence.addEvent(juce::MidiMessage::programChange(midiChannel, gmProgram), 0.0);

    auto endBeat = 0.0;
    for (const auto& note : notes)
    {
        sequence.addEvent(juce::MidiMessage::noteOn(midiChannel, note.pitch,
                                                     static_cast<juce::uint8>(note.velocity)),
                          note.startBeats * 960.0);
        sequence.addEvent(juce::MidiMessage::noteOff(midiChannel, note.pitch),
                          (note.startBeats + note.lengthBeats) * 960.0);
        endBeat = juce::jmax(endBeat, note.startBeats + note.lengthBeats);
    }

    if (humanizeAmount01 > 0.001f && midiChannel != 10)
    {
        juce::Random rng(seed ^ 0x5EDA1);
        for (double bar = 0.0; bar < endBeat; bar += 4.0)
        {
            const auto pressure = juce::jlimit(64, 127,
                96 + juce::roundToInt((rng.nextFloat() * 2.0f - 1.0f) * 31.0f * humanizeAmount01));
            const auto pressTime = juce::jmax(0.0, bar + rng.nextDouble() * 0.06 * humanizeAmount01);
            sequence.addEvent(juce::MidiMessage::controllerEvent(midiChannel, 64, pressure), pressTime * 960.0);
            sequence.addEvent(juce::MidiMessage::controllerEvent(midiChannel, 64, 0),
                              (juce::jmin(bar + 4.0, endBeat) - 0.05) * 960.0);
        }
    }

    sequence.updateMatchedPairs();
    return sequence;
}

bool saveMidiFile(juce::MidiFile& midiFile, const juce::File& target)
{
    target.getParentDirectory().createDirectory();
    target.deleteFile();
    juce::FileOutputStream out(target);
    if (! out.openedOk())
        return false;

    midiFile.writeTo(out);
    out.flush();
    return true;
}
}

bool MidiGenerator::writeMidiFile(const std::vector<GeneratedNote>& notes, double tempoBpm,
                                  float humanizeAmount01, juce::int64 seed,
                                  const juce::File& target, int midiChannel, int gmProgram)
{
    if (notes.empty())
        return false;

    juce::MidiFile midiFile;
    midiFile.setTicksPerQuarterNote(960);
    auto sequence = buildSequence(notes, humanizeAmount01, seed, midiChannel, gmProgram);
    sequence.addEvent(juce::MidiMessage::tempoMetaEvent(
        int(60000000.0 / juce::jlimit(20.0, 300.0, tempoBpm))), 0.0);
    sequence.sort();
    midiFile.addTrack(sequence);
    return saveMidiFile(midiFile, target);
}

bool MidiGenerator::writeMultiTrackFile(const std::vector<GeneratedTrack>& tracks,
                                        double tempoBpm, const juce::File& target)
{
    if (tracks.empty())
        return false;

    juce::MidiFile midiFile;
    midiFile.setTicksPerQuarterNote(960);

    juce::MidiMessageSequence tempoTrack;
    tempoTrack.addEvent(juce::MidiMessage::tempoMetaEvent(
        int(60000000.0 / juce::jlimit(20.0, 300.0, tempoBpm))), 0.0);
    midiFile.addTrack(tempoTrack);

    auto nextChannel = 1;
    for (const auto& track : tracks)
    {
        auto channel = track.isDrums ? 10 : nextChannel;
        if (! track.isDrums && ++nextChannel == 10)
            ++nextChannel;
        channel = juce::jlimit(1, 16, channel);
        auto sequence = buildSequence(track.notes, 0.0f, 0,
                                      channel, track.isDrums ? -1 : track.gmProgram);
        midiFile.addTrack(sequence);
    }

    return saveMidiFile(midiFile, target);
}

bool MidiGenerator::loadMidiFile(const juce::File& source,
                                 std::vector<GeneratedNote>& notes, double& tempoBpm)
{
    juce::FileInputStream in(source);
    juce::MidiFile midiFile;
    if (! in.openedOk() || ! midiFile.readFrom(in))
        return false;

    const auto timeFormat = midiFile.getTimeFormat();
    if (timeFormat <= 0)
        return false;
    const auto ppq = static_cast<double>(timeFormat);

    notes.clear();
    tempoBpm = 120.0;

    for (int track = 0; track < midiFile.getNumTracks(); ++track)
    {
        auto sequence = *midiFile.getTrack(track);
        sequence.updateMatchedPairs();

        for (int i = 0; i < sequence.getNumEvents(); ++i)
        {
            const auto* event = sequence.getEventPointer(i);
            const auto& msg = event->message;

            if (msg.isTempoMetaEvent())
                tempoBpm = juce::jlimit(20.0, 300.0, 60.0 / msg.getTempoSecondsPerQuarterNote());

            if (msg.isNoteOn() && event->noteOffObject != nullptr)
            {
                GeneratedNote note;
                note.pitch = msg.getNoteNumber();
                note.velocity = juce::jmax(1, static_cast<int>(msg.getVelocity()));
                note.startBeats = msg.getTimeStamp() / ppq;
                note.lengthBeats = juce::jmax(0.05,
                    (event->noteOffObject->message.getTimeStamp() - msg.getTimeStamp()) / ppq);
                notes.push_back(note);
                if (notes.size() >= 2000)
                    return true;
            }
        }
    }
    return ! notes.empty();
}

juce::String MidiGenerator::notesToJson(const std::vector<GeneratedNote>& notes,
                                        double tempoBpm, int maxNotes)
{
    juce::Array<juce::var> noteArray;
    for (const auto& n : notes)
    {
        noteArray.add(makeObject({ { "pitch", n.pitch },
                                   { "startBeats", n.startBeats },
                                   { "lengthBeats", n.lengthBeats },
                                   { "velocity", n.velocity } }));
        if (noteArray.size() >= maxNotes)
            break;
    }
    return juce::JSON::toString(makeObject({ { "tempoBpm", tempoBpm },
                                              { "notes", juce::var(noteArray) } }), true);
}

juce::String MidiGenerator::tracksToJson(const std::vector<GeneratedTrack>& tracks,
                                         double tempoBpm, int maxNotesPerTrack)
{
    juce::Array<juce::var> trackArray;
    for (const auto& track : tracks)
    {
        juce::Array<juce::var> noteArray;
        for (const auto& n : track.notes)
        {
            noteArray.add(makeObject({ { "pitch", n.pitch },
                                       { "startBeats", n.startBeats },
                                       { "lengthBeats", n.lengthBeats },
                                       { "velocity", n.velocity } }));
            if (noteArray.size() >= maxNotesPerTrack)
                break;
        }
        trackArray.add(makeObject({ { "name", track.name },
                                    { "instrument", track.instrument },
                                    { "gmProgram", track.gmProgram },
                                    { "isDrums", track.isDrums },
                                    { "notes", juce::var(noteArray) } }));
    }
    return juce::JSON::toString(makeObject({ { "tempoBpm", tempoBpm },
                                              { "tracks", juce::var(trackArray) } }), true);
}
}
