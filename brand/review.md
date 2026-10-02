1. **Initial screen has no obvious action or selected turf.**  
   Fix: default-select Turf `01` on load and open its take panel. Desktop: right panel width `416px`, grid shifts left. Mobile: bottom sheet height `360px`. Panel title: `Turf 01`; primary value: `Price to take 0.001 ETH`; CTA: `Connect wallet to take it`.

2. **The grid prices are too small to read in the one-second view.**  
   Fix: change turf-card price text from about `10px mono` to `12px`, `font-weight: 700`, `font-family: inherit`, `letter-spacing: -0.02em`; position bottom-right with `right: 8px; bottom: 7px`. Use `0.001 ETH`, not `0.001Ξ`.

3. **Mobile hides the actual price of each turf, so users can’t choose without tapping blindly.**  
   Fix: on `max-width: 480px`, make turf cards `34px × 34px` instead of the current tiny pill size, and show two lines: number `12px 700` top-left, price `9px 700` bottom-right. If space is still tight, show price only on held/selected cards and add a fixed bottom price bar: `Selected Turf 01 · 0.001 ETH`.

4. **The desktop panel CTA says “Connect wallet to take it” even in the opened turf state, but the top nav already has Connect; the main action reads like a duplicate wallet button.**  
   Fix: change panel CTA text to `Take Turf 46 for 0.001728 ETH`; if wallet is disconnected, keep the same label and trigger wallet connect first. Button height `56px`, radius `28px`.

5. **The first-screen stats don’t show the one number crypto users need before acting: current cheapest take price.**  
   Fix: replace the left stat `Takes 0` on the empty-state screen with `Cheapest turf` / `0.001 ETH`. Keep `Takes` only after activity or move it smaller under the grid.

6. **The mobile first screen scrolls into “How it works”, breaking the one-screen game feel.**  
   Fix: on mobile, remove the visible `How it works` section from the first viewport. Set the game section min-height to `100svh`; move `How it works` behind a pill button or below after at least `96px` spacing, not peeking immediately under the board.

7. **Held turf states are not distinct enough from selected state.**  
   Fix: use three exact states:  
   - unheld: background `#FFFDF7`, border `1px solid rgba(22,32,24,.16)`  
   - held: background `rgba(40,180,99,.12)`, border `1px solid #28B463`  
   - selected: border `2px solid #162018`, box-shadow `0 0 0 3px rgba(40,180,99,.22)`  
   The selected Turf 46 should not rely only on a green outline that looks like “held”.

8. **The turf object on the left is too small and decorative compared with the actual game.**  
   Fix: either enlarge it to `220px` wide desktop / remove it on mobile, or replace it with a live selected-turf card showing `Turf 01`, `Price 0.001 ETH`, `Next price 0.0012 ETH`. Current object width is about `160px`; set desktop width to `240px` if kept.