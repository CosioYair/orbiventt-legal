/* COUNTDOWN — OPTIONAL.
 *
 * Two states, both deliberate:
 *   • counting  — a grid of whole units, each with its own visible text label.
 *   • completed — a single message. The counter never renders zeros or negative
 *                 values, because an invitation link outlives its event and a
 *                 guest opening it the next morning must see something intended.
 *
 * ACCESSIBILITY: the number grid is `aria-hidden`, because announcing four bare
 * digits every second is noise, not information. A `role="status"` sentence
 * carries the same content in words and is refreshed at minute granularity. The
 * visible units carry text labels too, so the meaning never depends on layout,
 * color or motion — and there is no animation to reduce.
 */
import { el, setText } from '../dom.js';
import { countdownParts, countdownLabel, padUnit, UNITS } from '../countdown.js';
import { section } from './shell.js';

/** How often the visible counter ticks. */
const TICK_MS = 1000;

export default function renderCountdown(data, ctx) {
    if (!data) return null;
    const d = ctx.document;

    const initial = countdownParts(ctx.now, data.target.ms);
    if (!initial) return null;

    // Heading is template UI copy. The completed message is interface copy the
    // couple MAY override — so the config value wins when they wrote one, and
    // the template supplies the wording when they did not.
    const completedLabel = data.completedLabel || ctx.labels.countdownCompleted || '';

    const values = Object.create(null);

    const list = el('ol', {
        class: 'inv-countdown',
        attrs: { 'aria-hidden': 'true' },
        children: UNITS.map((unit) => {
            const value = el('span', {
                class: 'inv-countdown__value',
                text: padUnit(unit.key, initial[unit.key]),
                document: d,
            });
            values[unit.key] = value;
            return el('li', {
                class: 'inv-countdown__unit',
                attrs: { 'data-unit': unit.key },
                children: [
                    value,
                    el('span', { class: 'inv-countdown__label', text: unit.label, document: d }),
                ],
                document: d,
            });
        }),
        document: d,
    });

    const done = el('p', {
        class: 'inv-countdown__done',
        text: completedLabel,
        attrs: { hidden: initial.done ? null : true },
        document: d,
    });

    const status = el('p', {
        class: 'inv-sr-only',
        text: countdownLabel(initial, completedLabel),
        attrs: { role: 'status', 'aria-live': 'polite' },
        document: d,
    });

    if (initial.done) list.setAttribute('hidden', '');

    const node = section('countdown', ctx.labels.countdownHeading, ctx, [list, done, status], { class: 'inv-countdown-section' });

    // The ticker is attached only in a real browser; under test the initial
    // render is the whole observable behavior.
    if (ctx.setInterval) {
        let lastSpokenMinute = -1;
        const tick = () => {
            const parts = countdownParts(ctx.clock(), data.target.ms);
            if (!parts) return;
            if (parts.done) {
                list.setAttribute('hidden', '');
                done.removeAttribute('hidden');
                setText(status, completedLabel);
                if (ctx.clearInterval) ctx.clearInterval(handle);
                return;
            }
            for (const unit of UNITS) setText(values[unit.key], padUnit(unit.key, parts[unit.key]));
            if (parts.minutes !== lastSpokenMinute) {
                lastSpokenMinute = parts.minutes;
                setText(status, countdownLabel(parts, completedLabel));
            }
        };
        const handle = ctx.setInterval(tick, TICK_MS);
    }

    return node;
}
