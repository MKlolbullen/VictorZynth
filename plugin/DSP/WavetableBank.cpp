#include "WavetableBank.h"

#include <algorithm>
#include <cmath>

namespace aetherwave::dsp
{
namespace
{
constexpr double pi = 3.1415926535897932384626433832795;

float lerp(float a, float b, float t) noexcept
{
    return a + (b - a) * t;
}
}

WavetableBank::WavetableBank()
{
    generate();
}

void WavetableBank::normalise(Slice& slice) noexcept
{
    float peak = 0.0001f;
    for (const auto sample : slice)
        peak = std::max(peak, std::abs(sample));

    for (auto& sample : slice)
        sample /= peak;
}

void WavetableBank::generate()
{
    for (std::size_t s = 0; s < numSlices; ++s)
    {
        const auto norm = static_cast<float>(s) / static_cast<float>(numSlices - 1);

        for (std::size_t i = 0; i < tableSize; ++i)
        {
            const auto phase = static_cast<double>(i) / static_cast<double>(tableSize) * 2.0 * pi;

            // Analog Warmth: sine -> triangle -> saw/pulse.
            {
                const auto sine = static_cast<float>(std::sin(phase));
                const auto tri = static_cast<float>((std::asin(std::sin(phase)) * 2.0) / pi);
                float saw = 0.0f;
                for (int h = 1; h <= 12; ++h)
                    saw += static_cast<float>(std::sin(static_cast<double>(h) * phase) / static_cast<double>(h)) * (h % 2 == 0 ? -1.0f : 1.0f);
                saw *= 0.6f;

                if (norm < 0.33f)
                    tables[0][s][i] = lerp(sine, tri, norm / 0.33f);
                else if (norm < 0.66f)
                    tables[0][s][i] = lerp(tri, saw, (norm - 0.33f) / 0.33f);
                else
                {
                    const auto t = (norm - 0.66f) / 0.34f;
                    const auto pw = 0.5f - t * 0.35f;
                    const auto cycle = static_cast<float>(phase / (2.0 * pi));
                    const auto pulse = cycle < pw ? 1.0f : -1.0f;
                    tables[0][s][i] = lerp(saw, pulse, t);
                }
            }

            // Spectral Void: hollow odd harmonics with nonlinear dispersion.
            {
                constexpr std::array<int, 8> harmonics { 1, 3, 5, 7, 9, 11, 15, 21 };
                float value = 0.0f;
                for (std::size_t h = 0; h < harmonics.size(); ++h)
                {
                    const auto weight = std::pow(1.0f / static_cast<float>(h + 1), 1.2f - norm * 0.8f)
                                      * std::cos(norm * static_cast<float>(pi) * static_cast<float>(h + 1) * 0.5f);
                    value += static_cast<float>(std::sin(static_cast<double>(harmonics[h]) * phase)) * weight;
                }
                value += static_cast<float>(std::sin(phase * 0.5)) * (1.0f - norm) * 0.5f;
                tables[1][s][i] = std::tanh(value * (1.2f + norm * 2.0f));
            }

            // Celestial Drone: moving spectral focus and high shimmer.
            {
                constexpr std::array<int, 9> partials { 1, 2, 4, 5, 7, 8, 12, 16, 24 };
                float value = 0.0f;
                const auto centre = 1.0f + norm * 15.0f;
                for (const auto partial : partials)
                {
                    const auto distance = std::abs(static_cast<float>(partial) - centre);
                    const auto amp = std::exp(-distance * 0.3f);
                    value += static_cast<float>(std::sin(static_cast<double>(partial) * phase + norm * static_cast<float>(partial) * 0.3f)) * amp;
                }
                value += static_cast<float>(std::sin(phase * 9.0 + std::cos(phase * 3.0) * norm)) * 0.25f * norm;
                tables[2][s][i] = value;
            }

            // Vocal Formants: moving harmonic/formant peaks.
            {
                const auto f1 = 3.0f + norm * 4.0f;
                const auto f2 = 8.0f + (1.0f - norm) * 10.0f;
                const auto f3 = 18.0f + std::sin(norm * static_cast<float>(pi)) * 6.0f;
                float value = static_cast<float>(std::sin(phase));
                value += static_cast<float>(std::sin(f1 * phase)) * 0.7f;
                value += static_cast<float>(std::sin(f2 * phase)) * 0.5f;
                value += static_cast<float>(std::sin(f3 * phase)) * 0.25f * (norm + 0.2f);
                tables[3][s][i] = std::sin(phase) > 0.0 ? value : value * 0.6f;
            }

            // Cyber Wavefold: folded sine plus hard-sync-like ramp.
            {
                const auto base = static_cast<float>(std::sin(phase));
                const auto drive = 1.0f + norm * 6.0f;
                auto folded = std::sin(base * drive);
                if (std::abs(folded) > 0.8f)
                    folded = std::copysign(1.6f - std::abs(folded), folded);

                const auto syncMult = 1.0 + static_cast<double>(norm) * 3.5;
                const auto syncPhase = std::fmod(phase * syncMult, 2.0 * pi);
                const auto syncComponent = static_cast<float>((1.0 - syncPhase / (2.0 * pi)) * 2.0 - 1.0);
                tables[4][s][i] = folded * 0.7f + syncComponent * norm * 0.5f;
            }

            // Metallic Bell: inharmonic Chladni-like partial ratios.
            {
                constexpr std::array<double, 7> ratios { 1.0, 1.593, 2.135, 2.756, 3.598, 4.812, 6.24 };
                float value = 0.0f;
                for (std::size_t p = 0; p < ratios.size(); ++p)
                {
                    const auto weight = std::pow(0.75f, static_cast<float>(p) * (1.5f - norm));
                    value += static_cast<float>(std::sin(phase * ratios[p] + norm * 1.5f)) * weight;
                }
                tables[5][s][i] = value;
            }
        }

        for (auto& table : tables)
            normalise(table[s]);
    }
}

float WavetableBank::sample(int tableIndex, float position, double phase) const noexcept
{
    tableIndex = std::clamp(tableIndex, 0, static_cast<int>(numTables - 1));
    position = std::clamp(position, 0.0f, 1.0f);
    phase -= std::floor(phase);

    const auto slicePosition = position * static_cast<float>(numSlices - 1);
    const auto sliceA = static_cast<std::size_t>(std::floor(slicePosition));
    const auto sliceB = std::min(sliceA + 1, numSlices - 1);
    const auto sliceMix = slicePosition - static_cast<float>(sliceA);

    const auto tablePosition = phase * static_cast<double>(tableSize);
    const auto sampleA = static_cast<std::size_t>(std::floor(tablePosition)) % tableSize;
    const auto sampleB = (sampleA + 1) % tableSize;
    const auto sampleMix = static_cast<float>(tablePosition - std::floor(tablePosition));

    const auto& table = tables[static_cast<std::size_t>(tableIndex)];
    const auto a = lerp(table[sliceA][sampleA], table[sliceA][sampleB], sampleMix);
    const auto b = lerp(table[sliceB][sampleA], table[sliceB][sampleB], sampleMix);
    return lerp(a, b, sliceMix);
}
}
