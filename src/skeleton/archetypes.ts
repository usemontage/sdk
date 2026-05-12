export type MontageBlockLayout =
  | "dashboard"
  | "report"
  | "workspace"
  | "form"
  | "card"
  | "chart";

const SHIMMER_CSS = `
@keyframes mtgShimmer {
  0% { background-position: -400px 0 }
  100% { background-position: 400px 0 }
}
[data-mtg-skel] .mtg-sk {
  border-radius: 8px;
  background: linear-gradient(90deg, #EBEBEB 25%, #DCDCDC 50%, #EBEBEB 75%);
  background-size: 800px 100%;
  animation: mtgShimmer 1.6s ease-in-out infinite;
}
[data-mtg-skel] .mtg-sk-row { display: flex; gap: 12px; }
[data-mtg-skel] .mtg-sk-col { display: flex; flex-direction: column; gap: 12px; }
[data-mtg-skel] .mtg-sk-grid { display: grid; gap: 12px; }
`;

function pill(w: string, h: number, delay = 0): string {
  const delayStyle = delay ? `animation-delay:${delay}s;` : "";
  return `<div class="mtg-sk" style="width:${w};height:${h}px;${delayStyle}"></div>`;
}

function row(...children: string[]): string {
  return `<div class="mtg-sk-row">${children.join("")}</div>`;
}

function col(...children: string[]): string {
  return `<div class="mtg-sk-col">${children.join("")}</div>`;
}

const ARCHETYPES: Record<MontageBlockLayout, () => string> = {
  dashboard: () => col(
    pill("60%", 24),
    pill("40%", 14, 0.05),
    `<div class="mtg-sk-grid" style="grid-template-columns:repeat(4,1fr)">
      ${pill("100%", 72)}${pill("100%", 72, 0.1)}${pill("100%", 72, 0.15)}${pill("100%", 72, 0.2)}
    </div>`,
    pill("100%", 180, 0.1),
    pill("100%", 120, 0.2),
  ),

  report: () => col(
    pill("50%", 28),
    pill("80%", 14, 0.05),
    pill("100%", 12, 0.1),
    pill("90%", 12, 0.15),
    pill("100%", 140, 0.1),
    pill("100%", 12, 0.2),
    pill("70%", 12, 0.25),
    pill("100%", 12, 0.3),
  ),

  workspace: () => row(
    `<div class="mtg-sk-col" style="width:220px;flex-shrink:0">
      ${pill("80%", 16)}${pill("100%", 14, 0.05)}${pill("100%", 14, 0.1)}${pill("100%", 14, 0.15)}${pill("100%", 14, 0.2)}${pill("60%", 14, 0.25)}
    </div>`,
    `<div class="mtg-sk-col" style="flex:1;min-width:0">
      ${pill("40%", 24)}${pill("60%", 14, 0.05)}
      <div class="mtg-sk-grid" style="grid-template-columns:repeat(3,1fr)">
        ${pill("100%", 64)}${pill("100%", 64, 0.1)}${pill("100%", 64, 0.15)}
      </div>
      ${pill("100%", 160, 0.1)}
    </div>`,
  ),

  form: () => col(
    pill("35%", 22),
    pill("100%", 36, 0.05),
    pill("30%", 14, 0.1),
    pill("100%", 36, 0.15),
    pill("30%", 14, 0.2),
    pill("100%", 36, 0.25),
    pill("30%", 14, 0.3),
    pill("100%", 72, 0.35),
    row(pill("120px", 40, 0.4), pill("120px", 40, 0.45)),
  ),

  card: () => col(
    pill("50%", 20),
    pill("100%", 14, 0.05),
    pill("80%", 14, 0.1),
    pill("100%", 14, 0.15),
    pill("60%", 14, 0.2),
  ),

  chart: () => col(
    pill("40%", 20),
    pill("30%", 14, 0.05),
    pill("100%", 240, 0.1),
  ),
};

export function renderSkeletonMarkup(layout: MontageBlockLayout): string {
  const body = ARCHETYPES[layout]?.() ?? ARCHETYPES.card();
  return `<style>${SHIMMER_CSS}</style><div data-mtg-skel class="mtg-sk-col" style="padding:16px;width:100%;box-sizing:border-box">${body}</div>`;
}
