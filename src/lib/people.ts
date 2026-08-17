import type { Person } from './supabase'

// ── People colours ────────────────────────────────────────────────────────────
// Shared by the tasks board and the ongoing page so one person looks the same
// wherever they show up.

export type PersonColor = { label: string; swatch: string; chip: string; icon: string }

// Chips are filled: the colour is the background, the text sits on top of it.
export const PERSON_COLORS: Record<string, PersonColor> = {
  indigo:  { label: 'Indigo',  swatch: 'bg-indigo-400',  chip: 'bg-indigo-500 text-white',        icon: 'text-indigo-500 dark:text-indigo-400'  },
  blue:    { label: 'Blue',    swatch: 'bg-sky-400',     chip: 'bg-sky-500 text-white',           icon: 'text-sky-500 dark:text-sky-400'        },
  green:   { label: 'Green',   swatch: 'bg-emerald-400', chip: 'bg-emerald-600 text-white',       icon: 'text-emerald-500 dark:text-emerald-400'},
  yellow:  { label: 'Yellow',  swatch: 'bg-amber-400',   chip: 'bg-amber-400 text-amber-950',     icon: 'text-amber-500 dark:text-amber-400'    },
  orange:  { label: 'Orange',  swatch: 'bg-orange-400',  chip: 'bg-orange-500 text-white',        icon: 'text-orange-500 dark:text-orange-400'  },
  red:     { label: 'Red',     swatch: 'bg-rose-400',    chip: 'bg-rose-500 text-white',          icon: 'text-rose-500 dark:text-rose-400'      },
  purple:  { label: 'Purple',  swatch: 'bg-violet-400',  chip: 'bg-violet-500 text-white',        icon: 'text-violet-500 dark:text-violet-400'  },
  pink:    { label: 'Pink',    swatch: 'bg-pink-400',    chip: 'bg-pink-500 text-white',          icon: 'text-pink-500 dark:text-pink-400'      },
}

export const PERSON_COLOR_KEYS = ['indigo', 'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink']

// People predating the colour column (and any left unset) get a tint from their
// position, so two people never look alike by default.
export function resolvePersonColor(person: Person, index: number): string {
  if (person.color && PERSON_COLORS[person.color]) return person.color
  return PERSON_COLOR_KEYS[index % PERSON_COLOR_KEYS.length]
}
