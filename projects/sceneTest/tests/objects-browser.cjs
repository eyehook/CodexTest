const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const { defaults, lightDefaults } = await import(
    pathToFileURL(path.resolve(__dirname, "../model.js"))
  );
  const legacy = {
    version: 1,
    settings: defaults(),
    lights: [lightDefaults("spot")],
  };
  legacy.lights[0].intensity = 123;
  legacy.lights[0].shadows = true;
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
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.addInitScript((legacy) => {
      if (!sessionStorage.getItem("m2-test-seeded")) {
        localStorage.setItem("codex.sceneTest.v1", JSON.stringify(legacy));
        sessionStorage.setItem("m2-test-seeded", "1");
      }
    }, legacy);
    const url =
      process.env.SCENE_TEST_URL || "http://127.0.0.1:8095/projects/sceneTest/";
    await page.goto(url);
    await page.waitForFunction(() => window.sceneTest);
    await page.evaluate(() => sceneTest.app.renderer.setAnimationLoop(null));
    let snapshot = await page.evaluate(() => sceneTest.snapshot());
    assert.equal(snapshot.lights[0].intensity, 123);
    assert.equal(snapshot.objects.length, 0);
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("codex.sceneTest.v1")).version,
      ),
      1,
    );
    await page.getByRole("tab", { name: "Objects", exact: true }).click();
    for (const name of ["Sphere", "Cube", "Cylinder", "Pyramid"])
      await page
        .getByRole("button", { name: `+ ${name}`, exact: true })
        .click();
    snapshot = await page.evaluate(() => sceneTest.snapshot());
    assert.equal(snapshot.objects.length, 4);
    assert.equal(snapshot.selected, snapshot.objects[3].id);
    const objectSection = page
      .getByRole("heading", { name: "Object Settings", exact: true })
      .locator("..");
    assert.equal(
      await objectSection
        .getByRole("button", { name: "White", exact: true })
        .count(),
      0,
    );
    assert.equal(await objectSection.getByRole("slider").count(), 9);
    await page.getByRole("slider", { name: "All", exact: true }).fill("2.5");
    for (const axis of ["X", "Y", "Z"])
      assert.equal(
        await page
          .getByRole("slider", { name: axis, exact: true })
          .inputValue(),
        "2.5",
      );
    await page.getByRole("slider", { name: "X", exact: true }).fill("4");
    await page.getByRole("slider", { name: "Y", exact: true }).fill("0.1");
    await page.getByRole("slider", { name: "Z", exact: true }).fill("10");
    assert.equal(
      await page.getByRole("slider", { name: "All", exact: true }).inputValue(),
      "2.5",
    );
    await page.evaluate(() => {
      const a = sceneTest.app,
        objects = [...a.objects.records.values()];
      a.select(objects[1].data.id);
      a.select(objects[3].data.id);
    });
    assert.deepEqual(
      await page.evaluate(() => sceneTest.snapshot().objects[3].scale),
      [4, 0.1, 10],
    );
    assert.equal(
      await page.getByRole("slider", { name: "All", exact: true }).inputValue(),
      "2.5",
    );
    await page
      .getByRole("slider", { name: "All", exact: true })
      .evaluate((el) => {
        el.value = "2.5";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    assert.deepEqual(
      await page.evaluate(() => sceneTest.snapshot().objects[3].scale),
      [2.5, 2.5, 2.5],
    );
    for (const [name, value] of [
      ["Color R", "31"],
      ["Color G", "99"],
      ["Color B", "200"],
      ["Metalness", "0.78"],
      ["Roughness", "0.11"],
    ])
      await page.getByRole("slider", { name, exact: true }).fill(value);
    await page.getByLabel("Cast shadows", { exact: true }).uncheck();
    await page.getByLabel("Receive shadows", { exact: true }).uncheck();
    const materialCheck = await page.evaluate(() => {
      const a = sceneTest.app,
        records = [...a.objects.records.values()];
      a.objects.update();
      a.renderer.render(a.scene, a.camera);
      return {
        edited: records[3].data,
        other: records[0].data.material,
        opacity: records[3].root.material.opacity,
        flags: [records[3].root.castShadow, records[3].root.receiveShadow],
        swatch: document.querySelector("[data-swatch]").style.background,
      };
    });
    assert.deepEqual(materialCheck.edited.material, {
      type: "standard",
      color: [31, 99, 200],
      metalness: 0.78,
      roughness: 0.11,
    });
    assert.equal(materialCheck.opacity, 1);
    assert.deepEqual(materialCheck.flags, [false, false]);
    assert.deepEqual(materialCheck.other, {
      type: "standard",
      color: [255, 255, 255],
      metalness: 0,
      roughness: 0.5,
    });
    assert.equal(materialCheck.swatch, "rgb(31, 99, 200)");
    const selected = await page.evaluate(() => sceneTest.snapshot().selected);
    await page.getByRole("tab", { name: "Lights", exact: true }).click();
    assert.equal(
      await page.evaluate(() => sceneTest.snapshot().selected),
      selected,
    );
    await page
      .getByRole("heading", { name: "Object Settings", exact: true })
      .waitFor();
    await page.evaluate(() => {
      const a = sceneTest.app;
      a.select([...a.lights.records.keys()][0]);
    });
    assert.equal(
      await page
        .getByRole("tab", { name: "Lights", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await page
      .getByRole("heading", { name: "Spot Light Settings", exact: true })
      .waitFor();
    await page.evaluate(() => {
      const a = sceneTest.app;
      a.select([...a.objects.records.keys()][0]);
    });
    assert.equal(
      await page
        .getByRole("tab", { name: "Objects", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    const interaction = await page.evaluate(async () => {
      const a = sceneTest.app,
        T = await import("three"),
        h = a.input.hands[0],
        objects = [...a.objects.records.values()],
        errors = [];
      const check = (ok, message) => {
        if (!ok) errors.push(message);
      };
      const update = (controller) => {
        controller.updateMatrix();
        controller.updateWorldMatrix(true, true);
      };
      const aim = (point, orientation) => {
        const q = a.rig.getWorldQuaternion(new T.Quaternion());
        h.controller.position.copy(a.rig.worldToLocal(point.clone()));
        h.controller.quaternion.copy(q.invert().multiply(orientation));
        update(h.controller);
      };
      try {
        a.renderer.xr.isPresenting = true;
        a.rig.position.set(2, 0, -3);
        a.rig.rotation.y = 0.3;
        a.viewer.position.set(0.2, 1.65, 0.1);
        a.viewer.quaternion.identity();
        a.rig.updateMatrixWorld(true);
        objects.forEach((r, i) =>
          r.root.position.set(-1.8 + i * 1.2, 1.2, -1.8),
        );
        h.source = { handedness: "right" };
        h.controller.visible = h.grip.visible = true;
        a.ui.open = false;
        a.ui.group.visible = false;
        a.select(null);
        const target = objects[0];
        aim(
          target.root
            .getWorldPosition(new T.Vector3())
            .add(new T.Vector3(0, 0, 0.7)),
          new T.Quaternion(),
        );
        h.controller.dispatchEvent({ type: "selectstart" });
        h.controller.dispatchEvent({ type: "selectend" });
        check(
          a.interaction.selected === target.data.id,
          "trigger ray selects actual primitive mesh",
        );
        check(h.hit.record?.root === target.root, "ray hit is actual geometry");
        check(
          a.ui.open && a.ui.group.visible && a.ui.tab === "objects",
          "selection opens hidden panels and activates Objects",
        );
        const eye = a.viewCamera().getWorldPosition(new T.Vector3()),
          f = a.viewCamera().getWorldDirection(new T.Vector3());
        f.y = 0;
        f.normalize();
        const toPanel = a.ui.group.position.clone().sub(eye);
        toPanel.y = 0;
        toPanel.normalize();
        check(
          Math.abs(f.angleTo(toPanel) - Math.PI / 4) < 1e-6,
          "automatic panel opens 45 degrees right",
        );
        check(
          a.ui.panels[2].mesh.position.x > a.ui.panels[1].mesh.position.x,
          "settings are to palette right",
        );
        const panelPosition = a.ui.group.position.clone();
        a.rig.position.x += 0.5;
        a.rig.updateMatrixWorld(true);
        a.objects.update();
        check(
          a.ui.group.position.distanceTo(panelPosition) < 1e-8,
          "panels remain fixed after moving",
        );
        // Existing grabs do not auto-select; currently selected grabs preserve selection.
        h.grip.position.set(3, 1, 2);
        h.grip.quaternion.identity();
        update(h.grip);
        h.hit = { record: target };
        a.input.beginGrab(h);
        check(
          a.interaction.selected === target.data.id,
          "grabbing selected object preserves selection",
        );
        a.input.endGrab(h);
        a.select(objects[1].data.id);
        h.hit = { record: target };
        a.input.beginGrab(h);
        check(
          a.interaction.selected === null,
          "different existing grab clears selection",
        );
        check(
          a.ui.panels[2].rows[0].label === "Nothing selected",
          "cleared contextual panel",
        );
        a.input.endGrab(h);
        check(a.interaction.selected === null, "release does not select");
        // Actual ray-grip creation from each of the four palette prototypes.
        a.ui.setTab("objects");
        a.ui.group.visible = true;
        a.ui.group.updateMatrixWorld(true);
        for (const [i, type] of [
          "sphere",
          "cube",
          "cylinder",
          "pyramid",
        ].entries()) {
          const proto = a.ui.prototypes.find(
              (p) => p.userData.prototype === type,
            ),
            before = proto.getWorldPosition(new T.Vector3()),
            q = a.ui.group.getWorldQuaternion(new T.Quaternion()),
            normal = new T.Vector3(0, 0, 1).applyQuaternion(q);
          aim(before.clone().addScaledVector(normal, 0.6), q);
          h.grip.position.copy(h.controller.position);
          h.grip.quaternion.copy(h.controller.quaternion);
          update(h.grip);
          const count = a.objects.records.size;
          h.controller.dispatchEvent({ type: "squeezestart" });
          const r = a.input.grabs.get(h);
          check(
            !!r && r.data.type === type && r.kind === "object",
            `${type} palette grip creates primitive`,
          );
          if (!r) continue;
          check(a.objects.records.size === count + 1, "new instance added");
          check(a.interaction.selected === r.data.id, "new instance selected");
          check(
            a.ui.panels[2].title === "Object Settings",
            "new instance shows Object Settings",
          );
          check(
            r.root.getWorldPosition(new T.Vector3()).distanceTo(before) < 1e-6,
            "creation preserves initial offset",
          );
          check(proto.parent === a.ui.group, "prototype stays available");
          h.grip.position.x += 0.3;
          h.grip.rotateY(0.4);
          update(h.grip);
          check(
            r.root.getWorldPosition(new T.Vector3()).distanceTo(before) > 0.1,
            "object follows controller",
          );
          const scale = a.ui.panels[2].rows.find((row) => row.label === "All");
          scale.set(1.5);
          a.ui.refresh(false);
          check(
            r.root.scale.distanceTo(new T.Vector3(1.5, 1.5, 1.5)) < 1e-6,
            "scale edits work while held",
          );
          h.controller.dispatchEvent({ type: "squeezeend" });
          check(r.root.parent === a.scene, "released object stays in world");
          check(
            a.interaction.selected === r.data.id,
            "release preserves selection",
          );
          r.root.position.set(-2 + i * 1.4, 1.2, -1.2);
        }
        // Overlay feedback must not edit physical material properties.
        const r = objects[0],
          original = r.root.material.color.getHex();
        a.select(r.data.id);
        a.objects.update();
        check(
          r.outline.visible && r.outline.material.color.getHex() === 0x6effa4,
          "selected overlay",
        );
        a.select(null);
        r.hovered = true;
        a.objects.update();
        check(
          r.outline.visible && r.outline.material.color.getHex() === 0x59cfff,
          "hover overlay",
        );
        h.hit = { record: r };
        a.input.beginGrab(h);
        a.objects.update();
        check(r.outline.material.color.getHex() === 0xff944d, "grab overlay");
        check(
          r.root.material.color.getHex() === original,
          "highlight preserves material",
        );
        a.input.endGrab(h);
        a.select([...a.objects.records.values()].at(-1).data.id);
        h.hit = { record: a.entities.get(a.interaction.selected) };
        a.input.beginGrab(h);
        const removed = a.interaction.selected;
        a.deleteEntity(removed);
        check(
          !a.entities.get(removed) &&
            a.input.grabs.size === 0 &&
            a.interaction.owners.size === 0,
          "delete cleans up held entity",
        );
        check(a.interaction.selected === null, "delete clears selection");
      } finally {
        a.renderer.xr.isPresenting = false;
        a.input.releaseAll();
        h.source = null;
        h.controller.visible = h.grip.visible = false;
        a.rig.position.set(0, 0, 0);
        a.rig.rotation.set(0, 0, 0);
        a.rig.updateMatrixWorld(true);
        a.ui.group.visible = false;
        a.ui.place();
      }
      return errors;
    });
    assert.deepEqual(interaction, [], "object controller interactions");
    await page.evaluate(() => {
      const a = sceneTest.app;
      a.select([...a.objects.records.keys()][0]);
    });
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press("b");
    assert.equal(
      await page.evaluate(() => sceneTest.snapshot().selected),
      null,
    );
    await page.getByText("Nothing selected", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Save Scene", exact: true }).click();
    const saved = await page.evaluate(() => sceneTest.snapshot());
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("codex.sceneTest.v1")).version,
      ),
      2,
    );
    await page
      .getByRole("button", { name: "Reset Scene", exact: true })
      .click();
    snapshot = await page.evaluate(() => sceneTest.snapshot());
    assert.equal(snapshot.objects.length, 0);
    assert.equal(snapshot.lights.length, 0);
    assert.equal(snapshot.selected, null);
    assert.deepEqual(snapshot.settings, defaults());
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("codex.sceneTest.v1")).objects.length,
      ),
      saved.objects.length,
    );
    await page.reload();
    await page.waitForFunction(() => window.sceneTest);
    await page.evaluate(() => sceneTest.app.renderer.setAnimationLoop(null));
    snapshot = await page.evaluate(() => sceneTest.snapshot());
    assert.equal(snapshot.selected, null);
    assert.equal(snapshot.objects.length, saved.objects.length);
    assert.equal(snapshot.lights[0].intensity, 123);
    snapshot.objects.forEach((o, i) => {
      const old = saved.objects[i];
      for (const key of ["position", "rotation", "scale"])
        o[key].forEach((v, j) => assert(Math.abs(v - old[key][j]) < 1e-9));
      assert.deepEqual(
        { ...o, position: [], rotation: [], scale: [] },
        { ...old, position: [], rotation: [], scale: [] },
      );
    });
    await page.evaluate(() => {
      const a = sceneTest.app;
      a.select([...a.objects.records.keys()][0]);
    });
    await page
      .getByRole("button", { name: "Delete object", exact: true })
      .click();
    assert.equal(
      await page.evaluate(() => sceneTest.snapshot().objects.length),
      saved.objects.length - 1,
    );
    if (process.env.SCENE_SCREENSHOT) {
      await page.evaluate(() => {
        const a = sceneTest.app;
        a.select([...a.objects.records.keys()][0]);
        a.renderer.render(a.scene, a.camera);
      });
      await page.screenshot({ path: process.env.SCENE_SCREENSHOT });
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: v1 startup migration; four primitives; tabs/context; live materials; All/axis synchronization; automatic panel opening; actual primitive rays; four VR palette grips; offsets/scaling; highlights; delete-held cleanup; B; explicit v2 save/reset/reload.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
