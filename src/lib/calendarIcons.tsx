import {
  Dumbbell, Droplets, BookOpen, Utensils, Moon, Brain, Target, Zap,
  Coffee, Music, Pill, Leaf, Bike, DollarSign, Pencil, Sunrise,
  Sparkles, Star, Apple, Flame, Heart, Clock, Footprints, Trophy,
  Waves, Wind, Bed, Weight,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

export type IconKey =
  | 'Dumbbell' | 'Droplets' | 'BookOpen' | 'Utensils' | 'Moon' | 'Brain'
  | 'Target' | 'Zap' | 'Coffee' | 'Music' | 'Pill' | 'Leaf' | 'Bike'
  | 'DollarSign' | 'Pencil' | 'Sunrise' | 'Sparkles' | 'Star' | 'Apple'
  | 'Flame' | 'Heart' | 'Clock' | 'Footprints' | 'Trophy' | 'Waves'
  | 'Wind' | 'Bed' | 'Weight'

type IconDef = {
  component: React.ComponentType<LucideProps>
  color: string  // tailwind text color
  label: string
}

export const ICON_DEFS: Record<IconKey, IconDef> = {
  Dumbbell:   { component: Dumbbell,   color: 'text-violet-400',  label: 'Fitness'    },
  Droplets:   { component: Droplets,   color: 'text-sky-400',     label: 'Hydration'  },
  BookOpen:   { component: BookOpen,   color: 'text-amber-400',   label: 'Reading'    },
  Utensils:   { component: Utensils,   color: 'text-emerald-400', label: 'Diet'       },
  Moon:       { component: Moon,       color: 'text-indigo-400',  label: 'Sleep'      },
  Brain:      { component: Brain,      color: 'text-pink-400',    label: 'Focus'      },
  Target:     { component: Target,     color: 'text-orange-400',  label: 'Goals'      },
  Zap:        { component: Zap,        color: 'text-yellow-400',  label: 'Energy'     },
  Coffee:     { component: Coffee,     color: 'text-amber-500',   label: 'Morning'    },
  Music:      { component: Music,      color: 'text-fuchsia-400', label: 'Music'      },
  Pill:       { component: Pill,       color: 'text-cyan-400',    label: 'Meds'       },
  Leaf:       { component: Leaf,       color: 'text-green-400',   label: 'Nature'     },
  Bike:       { component: Bike,       color: 'text-teal-400',    label: 'Cycling'    },
  DollarSign: { component: DollarSign, color: 'text-emerald-500', label: 'Finance'    },
  Pencil:     { component: Pencil,     color: 'text-zinc-300',    label: 'Writing'    },
  Sunrise:    { component: Sunrise,    color: 'text-orange-300',  label: 'Routine'    },
  Sparkles:   { component: Sparkles,   color: 'text-violet-300',  label: 'Habits'     },
  Star:       { component: Star,       color: 'text-yellow-300',  label: 'Rating'     },
  Apple:      { component: Apple,      color: 'text-red-400',     label: 'Nutrition'  },
  Flame:      { component: Flame,      color: 'text-orange-400',  label: 'Streak'     },
  Heart:      { component: Heart,      color: 'text-rose-400',    label: 'Health'     },
  Clock:      { component: Clock,      color: 'text-zinc-400',    label: 'Time'       },
  Footprints: { component: Footprints, color: 'text-stone-400',   label: 'Steps'      },
  Trophy:     { component: Trophy,     color: 'text-yellow-500',  label: 'Challenge'  },
  Waves:      { component: Waves,      color: 'text-sky-300',     label: 'Swimming'   },
  Wind:       { component: Wind,       color: 'text-slate-400',   label: 'Breathing'  },
  Bed:        { component: Bed,        color: 'text-indigo-300',  label: 'Rest'       },
  Weight:     { component: Weight,     color: 'text-violet-500',  label: 'Strength'   },
}

export const ICON_KEYS = Object.keys(ICON_DEFS) as IconKey[]

export function isIconKey(v: string): v is IconKey {
  return v in ICON_DEFS
}

export function CalendarIcon({
  iconKey,
  size = 14,
  className,
}: {
  iconKey: string
  size?: number
  className?: string
}) {
  if (!isIconKey(iconKey)) return null
  const { component: Icon, color } = ICON_DEFS[iconKey]
  return <Icon size={size} className={className ?? color} />
}
