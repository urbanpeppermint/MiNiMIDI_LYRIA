/**
 * GenreInstrumentData.ts
 * Updated with safer prompts to avoid Lyria recitation errors
 */

export interface InstrumentConfig {
    id: string;
    name: string;
    emoji: string;
    keywords: string;
}

export interface GenreConfig {
    id: string;
    name: string;
    emoji: string;
    bpm: number;
    vibe: string;
    instruments: InstrumentConfig[];
}

// GENRE 1: ELECTRONIC
export const GENRE_ELECTRONIC: GenreConfig = {
    id: "electronic",
    name: "Electronic",
    emoji: "🎛️",
    bpm: 128,
    vibe: "energetic",
    instruments: [
        { id: "kick", name: "Kick", emoji: "🥁", keywords: "bass drum pattern with punch and low end" },
        { id: "snare", name: "Snare", emoji: "🪘", keywords: "electronic snare drum with reverb" },
        { id: "hihat", name: "Hi-Hat", emoji: "🔔", keywords: "rhythmic hi-hat cymbal pattern" },
        { id: "bass", name: "Bass", emoji: "🎸", keywords: "deep synthesizer bass with movement" },
        { id: "lead", name: "Lead", emoji: "🎹", keywords: "melodic synthesizer lead line" },
        { id: "pad", name: "Pad", emoji: "🌊", keywords: "ambient atmospheric synthesizer chords" },
        { id: "arp", name: "Arp", emoji: "✨", keywords: "arpeggiated synthesizer sequence" },
        { id: "fx", name: "FX", emoji: "💫", keywords: "atmospheric sound effects and textures" },
        { id: "perc", name: "Perc", emoji: "🎵", keywords: "electronic percussion and rhythmic elements" }
    ]
};

// GENRE 2: HIP HOP
export const GENRE_HIPHOP: GenreConfig = {
    id: "hiphop",
    name: "Hip Hop",
    emoji: "🎤",
    bpm: 90,
    vibe: "urban groovy",
    instruments: [
        { id: "kick808", name: "808 Kick", emoji: "💥", keywords: "deep booming bass drum" },
        { id: "snare", name: "Snare", emoji: "👏", keywords: "crisp snare drum with snap" },
        { id: "hihat", name: "Hi-Hats", emoji: "🔔", keywords: "rhythmic hi-hat patterns" },
        { id: "bass808", name: "808 Bass", emoji: "📢", keywords: "deep sub bass tone" },
        { id: "melody", name: "Melody", emoji: "🎹", keywords: "melodic piano or bell melody" },
        { id: "pad", name: "Pad", emoji: "🎻", keywords: "atmospheric string pad" },
        { id: "perc", name: "Perc", emoji: "🥢", keywords: "percussion and shaker elements" },
        { id: "keys", name: "Keys", emoji: "🎹", keywords: "electric piano chords" },
        { id: "bells", name: "Bells", emoji: "🔔", keywords: "bell and chime melody" }
    ]
};

// GENRE 3: LOFI JAZZ
export const GENRE_LOFI: GenreConfig = {
    id: "lofi",
    name: "Lofi Jazz",
    emoji: "☕",
    bpm: 75,
    vibe: "chill relaxing",
    instruments: [
        { id: "drums", name: "Drums", emoji: "🥁", keywords: "soft jazz drum groove" },
        { id: "bass", name: "Bass", emoji: "🎸", keywords: "warm walking bass line" },
        { id: "piano", name: "Piano", emoji: "🎹", keywords: "warm jazz piano chords" },
        { id: "guitar", name: "Guitar", emoji: "🎸", keywords: "clean jazz guitar melody" },
        { id: "sax", name: "Sax", emoji: "🎷", keywords: "smooth saxophone melody" },
        { id: "vibes", name: "Vibes", emoji: "✨", keywords: "vibraphone mallet melody" },
        { id: "vinyl", name: "Vinyl", emoji: "📀", keywords: "vinyl crackle ambient texture" },
        { id: "strings", name: "Strings", emoji: "🎻", keywords: "soft string ensemble" },
        { id: "ambient", name: "Ambient", emoji: "🌧️", keywords: "ambient background texture" }
    ]
};

// GENRE 4: HOUSE
export const GENRE_HOUSE: GenreConfig = {
    id: "house",
    name: "House",
    emoji: "🪩",
    bpm: 124,
    vibe: "funky danceable",
    instruments: [
        { id: "kick", name: "Kick", emoji: "🥁", keywords: "punchy house kick drum" },
        { id: "clap", name: "Clap", emoji: "👏", keywords: "rhythmic clap on offbeat" },
        { id: "hihat", name: "Hi-Hat", emoji: "🔔", keywords: "offbeat open hi-hat pattern" },
        { id: "bass", name: "Bass", emoji: "🎸", keywords: "groovy funky bass line" },
        { id: "piano", name: "Piano", emoji: "🎹", keywords: "house piano chord stabs" },
        { id: "strings", name: "Strings", emoji: "🎻", keywords: "disco string arrangement" },
        { id: "organ", name: "Organ", emoji: "🎹", keywords: "funky organ groove" },
        { id: "synth", name: "Synth", emoji: "🎛️", keywords: "filtered synthesizer sweep" },
        { id: "vocal", name: "Vocal", emoji: "🎤", keywords: "vocal sample chops" }
    ]
};

// GENRE 5: ROCK
export const GENRE_ROCK: GenreConfig = {
    id: "rock",
    name: "Rock",
    emoji: "🎸",
    bpm: 110,
    vibe: "powerful driving",
    instruments: [
        { id: "drums", name: "Drums", emoji: "🥁", keywords: "powerful rock drum beat" },
        { id: "bass", name: "Bass", emoji: "🎸", keywords: "driving electric bass" },
        { id: "rhythm", name: "Rhythm", emoji: "🎸", keywords: "distorted rhythm guitar chords" },
        { id: "lead", name: "Lead", emoji: "🎸", keywords: "electric guitar lead melody" },
        { id: "acoustic", name: "Acoustic", emoji: "🎸", keywords: "acoustic guitar strumming" },
        { id: "keys", name: "Keys", emoji: "🎹", keywords: "rock piano and organ" },
        { id: "synth", name: "Synth", emoji: "🎛️", keywords: "atmospheric synth pad" },
        { id: "perc", name: "Perc", emoji: "🥁", keywords: "tambourine and percussion" },
        { id: "fx", name: "FX", emoji: "💫", keywords: "guitar feedback and atmosphere" }
    ]
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getGenreByMode(mode: number): GenreConfig | null {
    switch (mode) {
        case 1: return GENRE_ELECTRONIC;
        case 2: return GENRE_HIPHOP;
        case 3: return GENRE_LOFI;
        case 4: return GENRE_HOUSE;
        case 5: return GENRE_ROCK;
        default: return null;
    }
}

export function getAllGenres(): GenreConfig[] {
    return [GENRE_ELECTRONIC, GENRE_HIPHOP, GENRE_LOFI, GENRE_HOUSE, GENRE_ROCK];
}

export function getGenreCount(): number {
    return 5;
}

/**
 * Build a SAFE prompt that avoids Lyria recitation errors
 * More generic descriptions work better
 */
export function buildSafePrompt(genre: GenreConfig, instrument: InstrumentConfig): string {
    // Use more generic, original descriptions to avoid recitation blocks
    return `Create a ${genre.vibe} ${genre.name.toLowerCase()} music loop at ${genre.bpm} beats per minute featuring ${instrument.keywords}. Make it a seamless 30 second instrumental loop with high quality production.`;
}

/**
 * Original simple prompt (may trigger recitation errors)
 */
export function buildSimplePrompt(genre: GenreConfig, instrument: InstrumentConfig): string {
    return `30 second seamless loop, ${genre.bpm} BPM, ${genre.vibe} ${genre.name} music, ${instrument.keywords}, instrumental, high quality production`;
}