/**
 * Atrium's brand green, and the CRM's one accent colour.
 *
 * Spent on exactly one thing across all three screens: a next step that is due.
 * That is the only thing in this CRM that needs to be noticed from across the
 * room, and a second use would cost the first one its meaning.
 *
 * It lives in its own file because all three screens need it and the pipeline
 * view is rendered by the worklist — importing it from there and back would be
 * a cycle.
 */
export const SIGNAL = '#6DBC61'
