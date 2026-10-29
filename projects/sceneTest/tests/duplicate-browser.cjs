const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    args: [
      "--enable-webgl",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      process.env.SCENE_TEST_URL || "http://127.0.0.1:8095/projects/sceneTest/",
    );
    await page.waitForFunction(() => window.sceneTest);
    await page.evaluate(() => sceneTest.app.renderer.setAnimationLoop(null));
    const result = await page.evaluate(async () => {
      const a = sceneTest.app,
        T = await import("three"),
        h = a.input.hands[0],
        left = a.input.hands[1],
        xr = a.renderer.xr,
        oldTracked = a.xrFrame.isTracked;
      const source = {
        handedness: "right",
        targetRaySpace: {},
        gripSpace: {},
        gamepad: {
          mapping: "xr-standard",
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 6 }, () => ({
            pressed: false,
            value: 0,
          })),
        },
      };
      let tracked = true;
      const failures = [];
      const check = (ok, label) => {
        if (!ok) failures.push(label);
      };
      const matrix = (o) => {
        o.updateMatrix();
        o.updateWorldMatrix(true, true);
      };
      const tick = () => {
        a.xrFrame.active = true;
        a.viewerPose = {};
        a.ui.group.visible = false;
        a.input.update(0.016, null);
        a.lights.update();
        a.objects.update();
      };
      const button = (down) => {
        source.gamepad.buttons[4].pressed = down;
        source.gamepad.buttons[4].value = down ? 1 : 0;
      };
      const pointAt = (p, q = new T.Quaternion()) => {
        h.controller.position.copy(p);
        h.controller.quaternion.copy(q);
        matrix(h.controller);
      };
      const near = (v, w) => v.distanceTo(w) < 1e-7;
      try {
        xr.isPresenting = true;
        a.xrFrame.isTracked = () => tracked;
        h.source = source;
        a.viewer.position.set(0, 1.65, 0);
        a.viewer.quaternion.identity();
        for (const [kind, type] of [
          ["light", "point"],
          ["light", "spot"],
          ["light", "directional"],
          ["light", "area"],
          ["object", "sphere"],
          ["object", "cube"],
          ["object", "cylinder"],
          ["object", "pyramid"],
        ]) {
          a.reset();
          button(false);
          h.grip.position.set(0.2, 1.1, 0);
          h.grip.quaternion.identity();
          matrix(h.grip);
          const original = a.entities.create(kind, type);
          original.root.position.set(0, 1.3, -2);
          original.root.rotation.set(0.1, 0.2, 0.05);
          if (kind === "object") {
            Object.assign(original.data, {
              scale: [1.3, 0.7, 2.2],
              allScale: 2.5,
              castShadow: false,
              receiveShadow: false,
            });
            Object.assign(original.data.material, {
              color: [45, 100, 190],
              metalness: 0.73,
              roughness: 0.19,
            });
            a.objects.apply(original);
          } else {
            Object.assign(original.data, {
              enabled: type !== "point",
              color: [125, 70, 200],
              intensity: 1.7,
              range: 12.3,
              angle: 47,
              penumbra: 0.67,
              width: 3.2,
              height: 1.4,
              shadows: type !== "area",
            });
            a.lights.apply(original);
          }
          pointAt(new T.Vector3(0, 1.3, 0));
          tick();
          const initial = structuredClone(original.data),
            p = original.root.getWorldPosition(new T.Vector3()),
            q = original.root.getWorldQuaternion(new T.Quaternion());
          a.ui.open = false;
          button(true);
          tick();
          const copy = a.input.grabs.get(h);
          check(!!copy, `${type}: A creates a held copy`);
          if (!copy) continue;
          check(
            copy.data.id !== original.data.id && copy.kind === kind,
            "fresh ID and same entity kind",
          );
          check(
            a.interaction.selected === copy.data.id && a.ui.open,
            "copy selected and hidden panels opened",
          );
          check(
            a.input.grabButtons.get(h) === "duplicate",
            "A owns duplicate hold",
          );
          check(
            near(copy.root.getWorldPosition(new T.Vector3()), p) &&
              Math.abs(
                copy.root.getWorldQuaternion(new T.Quaternion()).dot(q),
              ) >
                1 - 1e-7,
            "copy starts at source world transform without snapping",
          );
          const data = {
            ...copy.data,
            id: initial.id,
            position: initial.position,
            rotation: initial.rotation,
          };
          check(
            JSON.stringify(data) === JSON.stringify(initial),
            `${type}: all settings copied`,
          );
          if (kind === "object") {
            check(
              copy.root.material !== original.root.material,
              "independent copy material",
            );
            copy.data.material.color[0] = 210;
            a.objects.apply(copy);
            check(
              original.data.material.color[0] === 45,
              "source material unchanged",
            );
          } else
            check(
              (copy.light !== original.light &&
                copy.target !== original.target) ||
                !copy.target,
              "independent light and target",
            );
          const count = [...a.entities.values()].length;
          for (let i = 0; i < 4; i++) tick();
          check(
            [...a.entities.values()].length === count,
            "holding A does not repeat duplication",
          );
          h.controller.dispatchEvent({ type: "squeezestart" });
          h.controller.dispatchEvent({ type: "squeezeend" });
          check(
            a.input.grabs.get(h) === copy,
            "grip release does not drop A-held copy",
          );
          h.grip.position.x += 0.8;
          h.grip.position.z += 0.3;
          h.grip.rotateY(0.4);
          matrix(h.grip);
          tick();
          const placed = copy.root.getWorldPosition(new T.Vector3());
          check(placed.distanceTo(p) > 0.1, "copy follows translation");
          check(
            Math.abs(copy.root.getWorldQuaternion(new T.Quaternion()).dot(q)) <
              0.999,
            "copy follows rotation",
          );
          check(
            near(original.root.getWorldPosition(new T.Vector3()), p),
            "original stays in place",
          );
          button(false);
          tick();
          check(
            !a.input.grabs.has(h) &&
              copy.root.parent === a.scene &&
              near(copy.root.position, placed),
            "A release places copy",
          );
          check(
            a.interaction.selected === copy.data.id,
            "placed copy remains selected",
          );
        }
        // Empty pointing and left-controller X must not create copies.
        button(false);
        tick();
        pointAt(new T.Vector3(30, 5, 0));
        button(true);
        const count = [...a.entities.values()].length;
        tick();
        check(
          [...a.entities.values()].length === count,
          "A on empty space is harmless",
        );
        button(false);
        tick();
        left.source = {
          handedness: "left",
          targetRaySpace: {},
          gripSpace: {},
          gamepad: {
            mapping: "xr-standard",
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 6 }, (_, i) => ({
              pressed: i === 4,
              value: i === 4 ? 1 : 0,
            })),
          },
        };
        tick();
        check(
          [...a.entities.values()].length === count,
          "left X does not duplicate",
        );
        left.source = null;
        // Ordinary grip ownership must survive an A release.
        const target = [...a.objects.records.values()][0];
        h.grip.position.set(4, 3, 2);
        matrix(h.grip);
        h.hit = { record: target };
        a.input.beginGrab(h);
        button(true);
        tick();
        button(false);
        tick();
        check(
          a.input.grabs.get(h) === target,
          "A release does not drop grip-held source",
        );
        a.input.endGrab(h);
        // Tracking loss ends the hold; resuming with A down must not make another copy.
        target.root.position.set(0, 1.3, -2);
        target.root.quaternion.identity();
        pointAt(new T.Vector3(0, 1.3, 0));
        button(false);
        tick();
        button(true);
        tick();
        const held = a.input.grabs.get(h);
        check(!!held, "new A edge duplicates again");
        const beforeLoss = [...a.entities.values()].length;
        tracked = false;
        tick();
        check(
          !a.input.grabs.has(h) && held?.root.parent === a.scene,
          "tracking loss releases duplicate",
        );
        tracked = true;
        tick();
        tick();
        check(
          [...a.entities.values()].length === beforeLoss,
          "held A after recovery does not duplicate",
        );
        // Deleting a duplicate mid-hold clears both ownership maps.
        button(false);
        tick();
        button(true);
        tick();
        const deleted = a.input.grabs.get(h);
        if (deleted) {
          a.deleteEntity(deleted.data.id);
          check(
            !a.input.grabs.has(h) &&
              !a.input.grabButtons.has(h) &&
              a.interaction.owners.size === 0,
            "delete-held copy cleans ownership",
          );
          tick();
          check(
            !a.input.grabs.has(h),
            "holding after delete does not re-create copy",
          );
        } else check(false, "delete scenario creates duplicate");
        button(false);
        tick();
        a.save();
        const saved = JSON.parse(localStorage.getItem("codex.sceneTest.v1"));
        check(
          saved.objects.length === a.objects.records.size,
          "placed copies serialize",
        );
      } finally {
        a.input.releaseAll();
        h.source = null;
        left.source = null;
        h.controller.visible =
          h.grip.visible =
          left.controller.visible =
          left.grip.visible =
            false;
        a.xrFrame.isTracked = oldTracked;
        a.xrFrame.active = true;
        xr.isPresenting = false;
        a.viewerPose = null;
        a.ui.group.visible = false;
      }
      return {
        failures,
        objects: a.objects.records.size,
        lights: a.lights.records.size,
      };
    });
    assert.deepEqual(result.failures, []);
    await page.reload();
    await page.waitForFunction(() => window.sceneTest);
    assert.equal(
      await page.evaluate(() => sceneTest.snapshot().objects.length),
      result.objects,
    );
    assert.equal(
      await page.evaluate(() => sceneTest.snapshot().lights.length),
      result.lights,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: A duplication for all 8 types, independent settings, selection, offset/rotation, one copy per press, release ownership, tracking recovery, delete-held cleanup and persistence.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
