# Profiling simulation playback

Run `npm run debugdev`, open the application and open the browser's Developer
Tools **Console**. Keep Info/Log messages and worker messages visible; disabling
the Console's “selected context only” filter lets coordinator/helper reports
appear together. Filter for `Emergence debugdev` to find report headings. The
terminal runs Vite; the calculations and their reports run in the browser.

Use a saved world that feels slow, restore it, then play for several report
windows. Compare the same save and elapsed simulated days when evaluating a
change. A new, nearly empty world does not represent a diverse established one.

## Configuration

Edit root [`degugdev-config.json`](../degugdev-config.json)
and restart `npm run debugdev`, then reload the page. Invalid keys/types fail
at startup with an error instead of silently using a misspelled switch. No
dependencies were added. Normal `npm run dev`, static source publishing and
production builds do not enable the profiler. `enabled: false` also disables it.

| Setting | Effect |
| --- | --- |
| `enabled` | Master switch; false creates no profiler or reporting timer. |
| `reportIntervalMs` | Reporting interval, at least 250 ms; default 3,000. A busy worker reports after it yields. |
| `measure.<group>` | Enables timings/counters in this group. False avoids its clock reads. |
| `output.<group>` | Prints the measured group. False suppresses output but continues measurement. |
| `output.startup` | Prints an enablement notice and complete phase catalogue with measurement/output status. |
| `output.descriptions` | Includes a calculation explanation in each timing row. |
| `output.collapsed` | Collapses report groups to reduce console clutter. |

Both `measure` and `output` also accept an individual phase ID from the startup
catalogue. A phase switch overrides its group. For example, add
`"ecology.grazing": true` to `measure` to time grazing while the rest of the
`ecology` group stays off. Measurement switches never skip simulation work.

| Group | What is measured |
| --- | --- |
| `simulation` | Advancement, demography, dispersal, evolutionary assessment, daily history/census, community preparation. |
| `observations` | Requested compact/full observation latency, scoring-job preparation/detachment, notebook/map assembly and protective JSON copying. |
| `helpers` | Pool scheduling/waiting, local evaluation and individual helper computation. |
| `worker` | Commands, save restore/export, ancestry queries, reply posting and UI request/reply latency. |
| `ui` | Accepting a completed revision and updating notebook DOM/chart content. |
| `rendering` | Canvas drawing and associated view readouts. |
| `generation` | Physical world generation, reported before its temporary worker exits. |
| `workload` | Latest completed day/revision/turn, organisms, living/extinct species, occupied hexes, population pools, candidate directions and observed advancement rate. |
| `climate` | Model climate-cache misses and whole-atlas climate refreshes. |
| `genes` | Coordinator phenotype derivation on cache misses, genome descriptions and mutation trial enumeration/selection. |
| `ecology` | Resident preparation, photosynthesis, feeding demand, grazing, hunting and birth/death rates, including hypothetical scoring. |
| `detail` | Environment lookups including hits, routes, adaptation assessments, score lookups and novelty comparisons. |

The last four groups default off because frequent clock reads can distort small
operations. Enable one when the broader report points to it. You can keep its
measurement on and output off to distinguish logging overhead from timing overhead.

## Reading a report

Rows show **completed calls, total milliseconds, average milliseconds and worst
individual call**, sorted by total elapsed time. An asynchronous call can begin
in an earlier window; its full duration is recorded when it finishes. Counts are actual
function/phase executions, not individual organisms. For example, one demography
call updates all local populations in a biological turn; community ecology is
also repeatedly evaluated for hypothetical adaptations and dispersal scores.

Timings are **inclusive**. `life.advance` contains `life.demography`, dispersal,
evolution and history; demography contains ecological phases. Observation assembly
contains serial candidate assessments. Never sum nested rows. Workers run
concurrently and report in separate labelled windows; their totals cannot be
added into one elapsed latency. `pool.total` includes waiting/transport;
`pool.helper` measures computation on that helper. Zero or absent calls mean the
phase was not measured/executed in this window, not that a biological rule was
disabled. Biology runs three turns per ten days; evolution runs every twelve
biological turns, so not every report contains every phase.

Workload counters come from completed public observations. A population pool is
a species/hex/habitat record, not an organism. Candidate directions are hypotheses,
not living species. The reported days/second includes idle time in the report
window and diagnostic overhead; it is not a CPU-only throughput benchmark.

`worker.roundTrip` measures UI introduction/advance/inspection requests through
receipt of their replies. It includes work, queueing, cloning and delivery.
`worker.post` measures only the synchronous posting call, not receiver delivery.
These timings do not isolate garbage collection, browser layout/compositing,
exact memory usage or network transfer. `ui.draw` covers JavaScript/Canvas calls,
not all later browser painting. Tiny timings can round to zero because browser
timer precision is limited. Clock reads use the browser's
[`performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)
in UI adapters; worker payloads use
[structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).

## Implemented optimizations — 2026-09-25

The four priorities from the initial profile are now implemented:

1. **Requested adaptation ranges.** Playback normally builds only a compact
   census/map observation. Opening a species requests its inherited traits;
   opening Possible adaptations requests that species' candidate ranges.
   Heavy selected-range requests can still use the worker pool. Each reply
   replaces the complete observation at one revision, avoiding stale detail joins.
2. **Zero-demand feeding.** Grazing/hunting stop when their remaining demand is
   zero. Entries with zero demand avoid access/capture calculations. Source order,
   active allocation arithmetic, finite resources and random draws stay intact.
3. **Population indexes and description caches.** A species index is rebuilt when
   the population array changes and retains original row order/references. Genome
   descriptions are cached by genome identity. Accepted changes and improved
   candidates create new genomes and therefore receive new descriptions.
4. **Smaller copies and fewer notebook refreshes.** Compact snapshots omit repeated
   carrier/trait/range payloads for collapsed species. High-speed playback publishes
   at most ten complete revisions per second, accumulating the same explicit days
   into the existing maximum-five-day batches. Paused steps and inspection remain
   immediate. The notebook reuses its chart for the same run/revision and locale.

No biological day, turn, mutation trial, climate rule or speed target was changed.
The optional proposal to halve biological frequency and change mutation likelihood
was deferred. Normal full headless observations remain available and unchanged.

Run the production-worker comparison after building:

```sh
npm run build
node scripts/benchmark-life-observations.js 4320
```

It compares full, collapsed, genes-only and selected-range observations from the
same initial states. It verifies identical final checkpoints, complete census/map
observations and requested species details, and reports round-trip timing and
serialized observation bytes. Two passes reverse mode order. The evolved case
continues forty five-day batches; the dense twelve-species fixture restores before
each four-day batch, with three warmups and fifteen measured samples. Restore and
Canvas/DOM costs are excluded. Ratios describe these workloads, not a universal
speed multiplier. See architecture decision 076 for the measured results.
