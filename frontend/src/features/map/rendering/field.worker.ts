import { renderField } from "./field";
self.onmessage = ({ data }) => {
  try {
    const tiles = renderField(
      data.dataset,
      data.routes,
      data.layer,
      data.frame,
      data.geometry,
    );
    self.postMessage(
      { id: data.id, tiles, geometry: data.geometry },
      { transfer: tiles.map((t) => t.pixels.buffer) },
    );
  } catch (error) {
    self.postMessage({ id: data.id, error: String(error) });
  }
};
