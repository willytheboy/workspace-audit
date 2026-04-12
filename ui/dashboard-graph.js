// @ts-check

import { getColor } from "./dashboard-utils.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * @typedef {import("./dashboard-types.js").AuditProject} AuditProject
 */

/**
 * @param {string} tagName
 * @param {Record<string, string | number>} [attributes]
 */
function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

/**
 * @param {AuditProject[]} apps
 */
function buildLinks(apps) {
  const nodeIds = new Set(apps.map((app) => app.id));
  const links = [];

  for (const app of apps) {
    for (const similar of app.similarApps || []) {
      if (!nodeIds.has(similar.id) || app.id >= similar.id) continue;
      links.push({ source: app.id, target: similar.id, value: similar.score });
    }
  }

  return links;
}

/**
 * @param {AuditProject[]} apps
 * @param {Array<{ source: string, target: string, value: number }>} links
 */
function rankNodes(apps, links) {
  const degrees = new Map(apps.map((app) => [app.id, 0]));
  for (const link of links) {
    degrees.set(link.source, (degrees.get(link.source) || 0) + 1);
    degrees.set(link.target, (degrees.get(link.target) || 0) + 1);
  }

  return apps
    .map((app) => ({ ...app, degree: degrees.get(app.id) || 0 }))
    .sort((left, right) => {
      if (right.degree !== left.degree) return right.degree - left.degree;
      if (right.qualityScore !== left.qualityScore) return right.qualityScore - left.qualityScore;
      return left.name.localeCompare(right.name);
    });
}

/**
 * @param {number} index
 */
function getRingInfo(index) {
  if (index === 0) {
    return { ring: 0, slot: 0, slotsInRing: 1 };
  }

  let remaining = index - 1;
  let ring = 1;
  while (true) {
    const slotsInRing = ring * 8;
    if (remaining < slotsInRing) {
      return { ring, slot: remaining, slotsInRing };
    }
    remaining -= slotsInRing;
    ring += 1;
  }
}

/**
 * @param {AuditProject[]} apps
 * @param {number} width
 * @param {number} height
 * @param {Array<{ source: string, target: string, value: number }>} links
 */
function layoutNodes(apps, width, height, links) {
  const rankedNodes = rankNodes(apps, links);
  const maxRing = getRingInfo(Math.max(0, rankedNodes.length - 1)).ring;
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusStep = Math.max(70, Math.min(width, height) / (maxRing + 2.5));

  return rankedNodes.map((node, index) => {
    const { ring, slot, slotsInRing } = getRingInfo(index);
    if (ring === 0) {
      return { ...node, x: centerX, y: centerY };
    }

    const angle = (-Math.PI / 2) + (slot / slotsInRing) * (Math.PI * 2);
    const radius = ring * radiusStep;
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  });
}

/**
 * @param {{ openModal: (id: string) => void }} options
 */
export function createGraphRenderer({ openModal }) {
  /**
   * @param {AuditProject[]} apps
   */
  function renderGraph(apps) {
    const wrapper = document.getElementById("app-graph-wrapper");
    wrapper.replaceChildren();

    if (!apps.length) {
      const empty = document.createElement("div");
      empty.style.cssText = "display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);";
      empty.textContent = "No apps matched the current filters.";
      wrapper.append(empty);
      return;
    }

    const width = wrapper.clientWidth || 1000;
    const height = wrapper.clientHeight || 700;
    const links = buildLinks(apps);
    const nodes = layoutNodes(apps, width, height, links);
    const positions = new Map(nodes.map((node) => [node.id, node]));
    const labeledIds = new Set(nodes.slice(0, Math.min(18, nodes.length)).map((node) => node.id));

    const svg = createSvgElement("svg", {
      width: "100%",
      height: "100%",
      viewBox: `0 0 ${width} ${height}`
    });

    const defs = createSvgElement("defs");
    const gradient = createSvgElement("linearGradient", {
      id: "graph-link-gradient",
      x1: "0%",
      y1: "0%",
      x2: "100%",
      y2: "0%"
    });
    gradient.append(
      createSvgElement("stop", { offset: "0%", "stop-color": "#3B82F6", "stop-opacity": "0.25" }),
      createSvgElement("stop", { offset: "100%", "stop-color": "#10B981", "stop-opacity": "0.45" })
    );
    defs.append(gradient);
    svg.append(defs);

    const backgroundGroup = createSvgElement("g");
    const ringCount = getRingInfo(Math.max(0, nodes.length - 1)).ring;
    const radiusStep = Math.max(70, Math.min(width, height) / (ringCount + 2.5));
    for (let ring = 1; ring <= ringCount; ring += 1) {
      backgroundGroup.append(createSvgElement("circle", {
        cx: width / 2,
        cy: height / 2,
        r: ring * radiusStep,
        fill: "none",
        stroke: "var(--border)",
        "stroke-opacity": "0.25",
        "stroke-dasharray": "6 10"
      }));
    }
    svg.append(backgroundGroup);

    const linkGroup = createSvgElement("g");
    for (const link of links) {
      const source = positions.get(link.source);
      const target = positions.get(link.target);
      if (!source || !target) continue;
      linkGroup.append(createSvgElement("line", {
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
        stroke: "url(#graph-link-gradient)",
        "stroke-opacity": Math.max(0.18, link.value / 140),
        "stroke-width": Math.max(1.2, link.value / 18)
      }));
    }
    svg.append(linkGroup);

    const nodeGroup = createSvgElement("g");
    for (const node of nodes) {
      const group = createSvgElement("g", {
        transform: `translate(${node.x}, ${node.y})`
      });
      group.style.cursor = "pointer";
      group.addEventListener("click", () => openModal(node.id));

      const radius = Math.max(10, node.qualityScore / 4);
      const halo = createSvgElement("circle", {
        r: radius + 6,
        fill: getColor(node.qualityScore),
        "fill-opacity": "0.14"
      });
      const circle = createSvgElement("circle", {
        r: radius,
        fill: getColor(node.qualityScore),
        stroke: "var(--surface)",
        "stroke-width": "2.5"
      });
      const title = createSvgElement("title");
      title.textContent = `${node.name} • Health ${node.qualityScore} • ${node.zone.toUpperCase()}`;

      group.append(halo, circle, title);

      if (labeledIds.has(node.id)) {
        const label = createSvgElement("text", {
          x: radius + 8,
          y: 4,
          fill: "var(--text)",
          "font-size": "11",
          "font-weight": "600"
        });
        label.textContent = node.name;
        group.append(label);
      }

      nodeGroup.append(group);
    }
    svg.append(nodeGroup);

    const legend = document.createElement("div");
    legend.style.cssText = "position:absolute;top:1rem;left:1rem;padding:0.75rem 1rem;border-radius:0.75rem;background:rgba(11,15,25,0.72);border:1px solid var(--border);backdrop-filter:blur(8px);font-size:0.85rem;color:var(--text-muted);max-width:320px;";
    legend.innerHTML = `<strong style="color:var(--text);display:block;margin-bottom:0.35rem;">Architecture Graph</strong><span>Static SVG layout. Node size tracks health score, and links represent detected overlap.</span>`;

    wrapper.style.position = "relative";
    wrapper.append(svg, legend);
  }

  return { renderGraph };
}
