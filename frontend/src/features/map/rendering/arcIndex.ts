import { angular, distanceToArc } from "../utils/corridorField";

type Arc = { a: number[]; b: number[]; length: number; bearing: number };
type Node = {
  center: number[];
  radius: number;
  indices?: number[];
  children?: Node[];
};
const R = 6371008.8;

export function indexArcs(arcs: Arc[]) {
  function build(indices: number[]): Node {
    const center = arcs[indices[Math.floor(indices.length / 2)]].a;
    // Triangle inequality bounds every point on every minor arc, including dateline crossings.
    const radius = Math.min(
      Math.PI,
      indices.reduce(
        (radius, i) =>
          Math.max(radius, angular(center, arcs[i].a) + arcs[i].length),
        0,
      ),
    );
    if (indices.length <= 8) return { center, radius, indices };
    const middle = Math.floor(indices.length / 2);
    return {
      center,
      radius,
      children: [build(indices.slice(0, middle)), build(indices.slice(middle))],
    };
  }
  const root = arcs.length ? build(arcs.map((_, i) => i)) : null;
  return (point: number[]) => {
    let index = 0,
      distance = Infinity;
    const lowerBound = (node: Node) =>
      Math.max(0, angular(point, node.center) - node.radius) * R;
    function visit(node: Node, bound: number) {
      // Tiny margin avoids floating-point pruning of an equally close original segment.
      if (bound > distance + 1e-6) return;
      if (node.indices) {
        for (const i of node.indices) {
          const arc = arcs[i];
          const candidate = distanceToArc(point, arc.a, arc.b, arc);
          if (candidate < distance || (candidate === distance && i < index)) {
            distance = candidate;
            index = i;
          }
        }
      } else {
        const [a, b] = node.children!;
        const da = lowerBound(a),
          db = lowerBound(b);
        if (da <= db) {
          visit(a, da);
          visit(b, db);
        } else {
          visit(b, db);
          visit(a, da);
        }
      }
    }
    if (root) visit(root, 0);
    return { index, distance };
  };
}
