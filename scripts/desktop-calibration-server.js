const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..");

const INSTRUMENTS = {
  flute: {
    label: "Bamboo Flute",
    imagePath: path.join(root, "assets", "images", "bamboo-flute-final.png"),
    calibrationPath: path.join(root, "src", "components", "BambooFlute", "calibration.generated.json"),
    imageSize: { width: 853, height: 1844 },
    defaults: [
      { degree: 1, sourceX: 426, sourceY: 553, visibleRadius: 73, hitRadius: 96, isRoot: true },
      { degree: 2, sourceX: 426, sourceY: 720, visibleRadius: 51, hitRadius: 76, isRoot: false },
      { degree: 3, sourceX: 426, sourceY: 870, visibleRadius: 51, hitRadius: 76, isRoot: false },
      { degree: 4, sourceX: 426, sourceY: 1022, visibleRadius: 51, hitRadius: 76, isRoot: false },
      { degree: 5, sourceX: 426, sourceY: 1176, visibleRadius: 51, hitRadius: 76, isRoot: false },
      { degree: 6, sourceX: 426, sourceY: 1331, visibleRadius: 51, hitRadius: 76, isRoot: false },
      { degree: 7, sourceX: 426, sourceY: 1492, visibleRadius: 51, hitRadius: 76, isRoot: false }
    ]
  },
  kalimba: {
    label: "Kalimba",
    imagePath: path.join(root, "assets", "images", "kalimba.png"),
    calibrationPath: path.join(root, "src", "components", "Kalimba", "calibration.generated.json"),
    imageSize: { width: 1857, height: 847 },
    defaults: [
      { degree: 1, sourceX: 475, sourceY: 402, visibleRadius: 50, hitRadius: 70, isRoot: true },
      { degree: 2, sourceX: 628, sourceY: 454, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 3, sourceX: 781, sourceY: 503, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 4, sourceX: 934, sourceY: 539, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 5, sourceX: 1087, sourceY: 503, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 6, sourceX: 1240, sourceY: 454, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 7, sourceX: 1393, sourceY: 402, visibleRadius: 50, hitRadius: 70, isRoot: false }
    ]
  },
  melodica: {
    label: "Melodica",
    imagePath: path.join(root, "assets", "images", "melodica.png"),
    calibrationPath: path.join(root, "src", "components", "Melodica", "calibration.generated.json"),
    imageSize: { width: 1536, height: 1024 },
    defaults: [
      { degree: 1, sourceX: 351, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: true },
      { degree: 2, sourceX: 492, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 3, sourceX: 639, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 4, sourceX: 717, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 5, sourceX: 867, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 6, sourceX: 1015, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false },
      { degree: 7, sourceX: 1170, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false }
    ]
  }
};

const instrumentId = ["kalimba", "melodica"].includes(process.env.INSTRUMENT) ? process.env.INSTRUMENT : "flute";
const instrumentConfig = INSTRUMENTS[instrumentId];
const calibrationPath = instrumentConfig.calibrationPath;
const imagePath = instrumentConfig.imagePath;
const port = Number(process.env.PORT || 4174);

function sendJson(response, value) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function isValidHole(hole) {
  return (
    hole &&
    typeof hole.degree === "number" &&
    typeof hole.sourceX === "number" &&
    typeof hole.sourceY === "number" &&
    typeof hole.visibleRadius === "number" &&
    typeof hole.hitRadius === "number" &&
    typeof hole.isRoot === "boolean"
  );
}

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>JamIt ${instrumentConfig.label} Calibration</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(420px, 62vh) minmax(280px, 360px);
        gap: 18px;
        justify-content: center;
        align-items: center;
        padding: 22px;
        color: #fff2d8;
        background: #080907;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .stage {
        position: relative;
        height: min(94vh, 920px);
        aspect-ratio: ${instrumentConfig.imageSize.width} / ${instrumentConfig.imageSize.height};
        overflow: hidden;
        border-radius: 34px;
        box-shadow: 0 22px 80px rgba(0, 0, 0, 0.55);
        background: #020302;
        user-select: none;
      }
      .stage img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        pointer-events: none;
      }
      .circle {
        position: absolute;
        display: grid;
        place-items: center;
        border: 2px solid rgba(95, 255, 212, 0.96);
        background: rgba(44, 227, 185, 0.08);
        color: #effff8;
        font-size: 20px;
        font-weight: 900;
        cursor: grab;
        touch-action: none;
        text-shadow: 0 1px 6px rgba(0,0,0,.9);
      }
      .circle.selected {
        border-color: #fff1ba;
        background: rgba(255, 224, 142, 0.14);
      }
      .handle {
        position: absolute;
        right: -11px;
        bottom: -11px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid #08241e;
        background: #5fffd4;
        cursor: nwse-resize;
      }
      aside {
        align-self: stretch;
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px;
        border: 1px solid rgba(255, 240, 210, 0.16);
        border-radius: 10px;
        background: rgba(255, 250, 238, 0.06);
      }
      h1 { margin: 0; font-size: 24px; line-height: 1.1; }
      p { margin: 0; color: rgba(255, 242, 216, 0.72); line-height: 1.45; }
      .stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .stat {
        padding: 10px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.26);
      }
      .stat span { display: block; color: rgba(255, 242, 216, 0.62); font-size: 12px; }
      .stat strong { display: block; margin-top: 4px; font-size: 18px; }
      button {
        min-height: 44px;
        border: 1px solid rgba(255, 240, 210, 0.2);
        border-radius: 8px;
        color: #130d05;
        background: #d9a04e;
        font: inherit;
        font-weight: 900;
        cursor: pointer;
      }
      button.secondary {
        color: #fff2d8;
        background: rgba(255, 242, 216, 0.08);
      }
      .status { min-height: 22px; color: #8fffdc; font-weight: 800; }
      @media (max-width: 820px) {
        body { grid-template-columns: 1fr; align-items: start; }
        .stage { width: min(100%, 420px); height: auto; justify-self: center; }
      }
    </style>
  </head>
  <body>
    <div class="stage" id="stage">
      <img src="/image" alt="${instrumentConfig.label} app background" />
    </div>
    <aside>
      <h1>Desktop Calibration</h1>
      <p>Drag a circle to move it. Drag its small bottom-right handle to resize. Save writes the shared calibration used by the mobile app.</p>
      <div class="stats">
        <div class="stat"><span>Zone</span><strong id="zone">1</strong></div>
        <div class="stat"><span>Radius</span><strong id="radius">0</strong></div>
        <div class="stat"><span>X</span><strong id="xpos">0</strong></div>
        <div class="stat"><span>Y</span><strong id="ypos">0</strong></div>
      </div>
      <button id="save">Save</button>
      <button class="secondary" id="reset">Reset to app defaults</button>
      <p class="status" id="status"></p>
    </aside>
    <script>
      const IMAGE_SIZE = ${JSON.stringify(instrumentConfig.imageSize)};
      const defaults = ${JSON.stringify(instrumentConfig.defaults)};
      const stage = document.getElementById("stage");
      const statusEl = document.getElementById("status");
      let holes = defaults.map((hole) => ({ ...hole }));
      let selectedDegree = 1;
      let drag = null;

      function getFrame() {
        const rect = stage.getBoundingClientRect();
        const scale = Math.max(rect.width / IMAGE_SIZE.width, rect.height / IMAGE_SIZE.height);
        const width = IMAGE_SIZE.width * scale;
        const height = IMAGE_SIZE.height * scale;
        return {
          rect,
          scale,
          offsetX: (rect.width - width) / 2,
          offsetY: (rect.height - height) / 2
        };
      }
      function sourceToStage(x, y) {
        const frame = getFrame();
        return {
          x: frame.offsetX + x * frame.scale,
          y: frame.offsetY + y * frame.scale,
          scale: frame.scale
        };
      }
      function stageToSource(clientX, clientY) {
        const frame = getFrame();
        const x = clientX - frame.rect.left;
        const y = clientY - frame.rect.top;
        return {
          sourceX: (x - frame.offsetX) / frame.scale,
          sourceY: (y - frame.offsetY) / frame.scale
        };
      }
      function render() {
        stage.querySelectorAll(".circle").forEach((node) => node.remove());
        holes.forEach((hole) => {
          const point = sourceToStage(hole.sourceX, hole.sourceY);
          const radius = hole.hitRadius * point.scale;
          const circle = document.createElement("div");
          circle.className = "circle" + (hole.degree === selectedDegree ? " selected" : "");
          circle.style.left = point.x - radius + "px";
          circle.style.top = point.y - radius + "px";
          circle.style.width = radius * 2 + "px";
          circle.style.height = radius * 2 + "px";
          circle.style.borderRadius = radius + "px";
          circle.textContent = String(hole.degree);
          circle.addEventListener("pointerdown", (event) => {
            selectedDegree = hole.degree;
            drag = { degree: hole.degree, mode: "move" };
            circle.setPointerCapture(event.pointerId);
            render();
          });
          const handle = document.createElement("div");
          handle.className = "handle";
          handle.addEventListener("pointerdown", (event) => {
            event.stopPropagation();
            selectedDegree = hole.degree;
            drag = { degree: hole.degree, mode: "resize" };
            handle.setPointerCapture(event.pointerId);
            render();
          });
          circle.appendChild(handle);
          stage.appendChild(circle);
        });
        updatePanel();
      }
      function updatePanel() {
        const hole = holes.find((item) => item.degree === selectedDegree) || holes[0];
        document.getElementById("zone").textContent = String(hole.degree);
        document.getElementById("xpos").textContent = String(Math.round(hole.sourceX));
        document.getElementById("ypos").textContent = String(Math.round(hole.sourceY));
        document.getElementById("radius").textContent = String(Math.round(hole.hitRadius));
      }
      window.addEventListener("pointermove", (event) => {
        if (!drag) return;
        const point = stageToSource(event.clientX, event.clientY);
        holes = holes.map((hole) => {
          if (hole.degree !== drag.degree) return hole;
          if (drag.mode === "move") {
            return { ...hole, sourceX: point.sourceX, sourceY: point.sourceY };
          }
          const dx = point.sourceX - hole.sourceX;
          const dy = point.sourceY - hole.sourceY;
          const hitRadius = Math.max(36, Math.min(150, Math.sqrt(dx * dx + dy * dy)));
          return { ...hole, hitRadius, visibleRadius: hitRadius * 0.72 };
        });
        render();
      });
      window.addEventListener("pointerup", () => { drag = null; });
      window.addEventListener("resize", render);
      document.getElementById("save").addEventListener("click", async () => {
        const response = await fetch("/calibration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holes })
        });
        if (!response.ok) {
          statusEl.textContent = "Save failed";
          return;
        }
        statusEl.textContent = "Saved. Metro should reload the phone app.";
      });
      document.getElementById("reset").addEventListener("click", () => {
        holes = defaults.map((hole) => ({ ...hole }));
        selectedDegree = 1;
        statusEl.textContent = "Reset locally. Press Save to apply.";
        render();
      });
      fetch("/calibration")
        .then((response) => response.json())
        .then((data) => {
          if (Array.isArray(data.holes) && data.holes.length === 7) {
            holes = data.holes;
          }
          render();
        })
        .catch(() => render());
    </script>
  </body>
</html>`;

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(page);
      return;
    }

    if (request.method === "GET" && request.url === "/image") {
      response.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "no-store"
      });
      fs.createReadStream(imagePath).pipe(response);
      return;
    }

    if (request.method === "GET" && request.url === "/calibration") {
      sendJson(response, JSON.parse(fs.readFileSync(calibrationPath, "utf8")));
      return;
    }

    if (request.method === "POST" && request.url === "/calibration") {
      const body = JSON.parse(await readBody(request));
      if (!Array.isArray(body.holes) || body.holes.length !== 7 || !body.holes.every(isValidHole)) {
        response.writeHead(400);
        response.end("Invalid calibration");
        return;
      }

      const envelope = {
        updatedAt: Date.now(),
        holes: body.holes
      };
      fs.writeFileSync(calibrationPath, JSON.stringify(envelope, null, 2) + "\n");
      sendJson(response, envelope);
      return;
    }

    response.writeHead(404);
    response.end("Not found");
  } catch (error) {
    response.writeHead(500);
    response.end(error instanceof Error ? error.message : "Unknown error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Desktop ${instrumentConfig.label} calibration running at http://127.0.0.1:${port}`);
});
