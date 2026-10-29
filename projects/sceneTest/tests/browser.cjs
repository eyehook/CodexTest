// Optional real-WebGL integration checks. Install Playwright or set PLAYWRIGHT_MODULE.
// SCENE_TEST_URL defaults to a locally served repository on port 8093.
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
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const url =
      process.env.SCENE_TEST_URL || "http://127.0.0.1:8093/projects/sceneTest/";
    await page.goto(url);
    await page.waitForFunction(() => window.sceneTest);
    await page.evaluate(() =>
      window.sceneTest.app.renderer.setAnimationLoop(null),
    );
    const navigation = await page.evaluate(async () => {
      const a = sceneTest.app,
        T = await import("three"),
        xr = a.renderer.xr;
      const original = {
        render: a.renderer.render,
        getSession: xr.getSession,
        getReferenceSpace: xr.getReferenceSpace,
        getCamera: xr.getCamera,
        last: a.last,
      };
      const inputs = a.input.hands.map((h) => h.source);
      const left = {
        handedness: "left",
        targetRaySpace: {},
        gripSpace: {},
        gamepad: { axes: [0, 0, 0, 0], buttons: [] },
      };
      const right = {
        handedness: "right",
        targetRaySpace: {},
        gripSpace: {},
        gamepad: { axes: [0, 0, 0, 0], buttons: [] },
      };
      let localPosition = new T.Vector3(0.65, 1.7, -0.4),
        localOrientation = new T.Quaternion();
      const frame = {
        getViewerPose: () => ({
          transform: { position: localPosition, orientation: localOrientation },
        }),
        getPose: () => ({}),
      };
      const point = () => {
        a.rig.updateWorldMatrix(true, false);
        return localPosition.clone().applyMatrix4(a.rig.matrixWorld);
      };
      let time = 10000;
      const step = () => {
        time += 50;
        a.frame(time, frame);
      };
      const errors = [];
      const check = (ok, label) => {
        if (!ok) errors.push(label);
      };
      try {
        xr.isPresenting = true;
        xr.getSession = () => ({ visibilityState: "visible" });
        xr.getReferenceSpace = () => ({});
        xr.getCamera = () => {
          throw new Error(
            "Navigation must not read the parentless renderer XR camera",
          );
        };
        a.renderer.render = () => {};
        a.input.hands[0].source = left;
        a.input.hands[1].source = right;
        a.rig.position.set(4, 0, -6);
        a.rig.rotation.set(0, 0.8, 0);
        a.rig.updateMatrixWorld(true);
        a.last = time;
        a.updateViewerPose(frame);
        check(
          a.viewCamera().getWorldPosition(new T.Vector3()).distanceTo(point()) <
            1e-8,
          "head position includes rig translation and yaw",
        );
        for (const [x, z, label] of [
          [0, -1, "forward"],
          [0, 1, "backward"],
          [1, 0, "right"],
          [-1, 0, "left"],
        ]) {
          const before = a.rig.position.clone();
          const heading = new T.Vector3(0, 0, -1).applyAxisAngle(
            new T.Vector3(0, 1, 0),
            a.rig.rotation.y,
          );
          const expected = new T.Vector3()
            .crossVectors(heading, new T.Vector3(0, 1, 0))
            .multiplyScalar(x)
            .addScaledVector(heading, -z)
            .multiplyScalar(1.3 * 0.05);
          left.gamepad.axes = [0, 0, x, z];
          step();
          check(
            a.rig.position.clone().sub(before).distanceTo(expected) < 1e-8,
            `${label} follows world headset heading after rig movement`,
          );
        }
        left.gamepad.axes = [0, 0, 0, 0];
        right.gamepad.axes = [0, 0, 1, 0];
        const pivot = point();
        const yawBefore = a.rig.rotation.y;
        for (let i = 0; i < 120; i++) {
          step();
          check(
            a.viewCamera().getWorldPosition(new T.Vector3()).distanceTo(pivot) <
              1e-7,
            "turning preserves the physically offset headset pivot",
          );
        }
        check(
          Math.abs(a.rig.rotation.y - (yawBefore - 120 * 1.1 * 0.05)) < 1e-8,
          "right stick turns right at the configured speed",
        );
        // Change the physical headset pose between frames: never use last render's heading.
        localPosition.set(-0.4, 1.6, 0.7);
        localOrientation.setFromEuler(new T.Euler(-0.4, 0.6, 0.15, "YXZ"));
        right.gamepad.axes = [0, 0, -1, 0];
        left.gamepad.axes = [0, 0, 1, -1];
        a.rig.updateMatrixWorld(true);
        const beforeHead = point(),
          beforeRig = a.rig.position.clone();
        const expectedYaw = a.rig.rotation.y + 1.1 * 0.05;
        const heading = new T.Vector3(0, 0, -1)
          .applyQuaternion(localOrientation)
          .applyAxisAngle(new T.Vector3(0, 1, 0), expectedYaw);
        heading.y = 0;
        heading.normalize();
        const shift = new T.Vector3()
          .crossVectors(heading, new T.Vector3(0, 1, 0))
          .add(heading)
          .multiplyScalar((1.3 * 0.05) / Math.sqrt(2));
        step();
        check(
          a
            .viewCamera()
            .getWorldPosition(new T.Vector3())
            .distanceTo(beforeHead.clone().add(shift)) < 1e-7,
          "simultaneous turn/walk uses current headset pose and new rig yaw",
        );
        // Reopened panels must use the same correct world pose.
        a.ui.place();
        const eye = a.viewCamera().getWorldPosition(new T.Vector3()),
          towardPanel = a.ui.group.position.clone().sub(eye);
        towardPanel.y = 0;
        towardPanel.normalize();
        const expectedPanel = heading
          .clone()
          .applyAxisAngle(new T.Vector3(0, 1, 0), -Math.PI / 4);
        check(
          towardPanel.distanceTo(expectedPanel) < 1e-7,
          "panels reopen to the world-space right after locomotion",
        );
      } finally {
        a.renderer.render = original.render;
        xr.getSession = original.getSession;
        xr.getReferenceSpace = original.getReferenceSpace;
        xr.getCamera = original.getCamera;
        xr.isPresenting = false;
        a.input.releaseAll();
        a.input.hands.forEach((h, i) => {
          h.source = inputs[i];
          h.controller.visible = h.grip.visible = false;
        });
        a.rig.position.set(0, 0, 0);
        a.rig.rotation.set(0, 0, 0);
        a.rig.updateMatrixWorld(true);
        a.viewerPose = null;
        a.last = original.last;
        a.ui.place();
      }
      return errors;
    });
    assert.deepEqual(navigation, [], "XR locomotion regression checks");

    assert.equal(
      (await page.evaluate(() => sceneTest.snapshot())).lights.length,
      0,
    );
    for (const name of [
      "Point Light",
      "Spot Light",
      "Directional Light",
      "Rectangular Area Light",
    ])
      await page
        .getByRole("button", { name: `+ ${name}`, exact: true })
        .click();
    assert.equal(
      (await page.evaluate(() => sceneTest.snapshot())).lights.length,
      4,
    );
    const initial = await page.evaluate(async () => {
      const a = sceneTest.app,
        T = await import("three"),
        records = [...a.lights.records.values()];
      records.forEach((r, i) => {
        r.root.position.set(-1.5 + i, 2, -1);
        r.root.lookAt(0, 0.5, -3);
        a.lights.apply(r);
      });
      a.interaction.select(records[0].data.id);
      a.ui.refresh();
      a.renderer.render(a.scene, a.camera);
      return {
        calls: a.renderer.info.render.calls,
        areaSupport: !!T.UniformsLib.LTC_HALF_1,
        types: records.map((r) => r.light.type),
      };
    });
    assert(initial.calls > 0);
    assert(initial.areaSupport);
    assert.deepEqual(initial.types, [
      "PointLight",
      "SpotLight",
      "DirectionalLight",
      "RectAreaLight",
    ]);
    await page
      .getByRole("slider", { name: "Intensity", exact: true })
      .fill("42");
    await page.getByRole("button", { name: "Red", exact: true }).click();
    await page.getByLabel("Cast shadows", { exact: true }).check();
    const properties = await page.evaluate(() => {
      const r = [...sceneTest.app.lights.records.values()][0];
      return {
        intensity: r.light.intensity,
        color: r.data.color,
        shadow: r.light.castShadow,
      };
    });
    assert.deepEqual(properties, {
      intensity: 42,
      color: [255, 0, 0],
      shadow: true,
    });
    await page.getByLabel("Global shadows", { exact: true }).uncheck();
    assert.deepEqual(
      await page.evaluate(() => {
        const r = [...sceneTest.app.lights.records.values()][0];
        return [r.light.castShadow, r.data.shadows];
      }),
      [false, true],
    );
    await page.getByLabel("Global shadows", { exact: true }).check();
    await page
      .getByLabel("Shadow resolution", { exact: true })
      .selectOption("256");
    const result = await page.evaluate(async () => {
      const a = sceneTest.app,
        T = await import("three"),
        records = [...a.lights.records.values()];
      for (const r of records) {
        if (r.light.shadow) r.data.shadows = true;
        a.lights.apply(r);
      }
      a.renderer.render(a.scene, a.camera);
      const maps = records
        .filter((r) => r.light.shadow)
        .map((r) => [r.light.shadow.mapSize.x, !!r.light.shadow.map]);
      const spot = records[1];
      spot.data.angle = 60;
      a.lights.apply(spot);
      spot.root.rotation.set(0.2, 0.8, 0);
      a.lights.update();
      const expected = new T.Vector3(0, 0, -1)
        .applyQuaternion(spot.root.quaternion)
        .add(spot.root.position);
      const directionError = spot.target.position.distanceTo(expected);
      const area = records[3];
      area.data.width = 3.5;
      area.data.height = 1.2;
      a.lights.apply(area);
      a.interaction.select(area.data.id);
      a.ui.refresh();
      return {
        maps,
        directionError,
        areaDimensions: [area.light.width, area.light.height],
        areaShadowControls: a.ui.panels[2].rows.filter(
          (r) => r.label === "Cast shadows",
        ).length,
      };
    });
    assert.deepEqual(result.maps, [
      [256, true],
      [256, true],
      [256, true],
    ]);
    assert(result.directionError < 1e-6);
    assert.deepEqual(result.areaDimensions, [3.5, 1.2]);
    assert.equal(result.areaShadowControls, 0);
    const grabs = await page.evaluate(async () => {
      const a = sceneTest.app,
        T = await import("three"),
        [r1, r2] = a.lights.records.values(),
        h = a.input.hands[0],
        h2 = a.input.hands[1];
      a.interaction.select(r1.data.id);
      h.grip.position.set(0, 1, 0);
      h.grip.rotation.set(0.1, 0.3, 0);
      h.grip.updateMatrix();
      h.grip.updateWorldMatrix(true, false);
      const before = r1.root.getWorldPosition(new T.Vector3()),
        qBefore = r1.root.getWorldQuaternion(new T.Quaternion());
      h.hit = { record: r1 };
      a.input.beginGrab(h);
      const preserved =
        r1.root.getWorldPosition(new T.Vector3()).distanceTo(before) < 1e-6 &&
        1 -
          Math.abs(
            qBefore.dot(r1.root.getWorldQuaternion(new T.Quaternion())),
          ) <
          1e-6;
      const selectedPreserved = a.interaction.selected === r1.data.id;
      h.grip.position.x += 0.8;
      h.grip.position.z += 0.3;
      h.grip.rotateY(0.4);
      h.grip.updateMatrix();
      h.grip.updateMatrixWorld(true);
      a.lights.update();
      const afterMove = r1.root.getWorldPosition(new T.Vector3());
      const moved = afterMove.distanceTo(before) > 0.1;
      a.input.endGrab(h);
      const released = r1.root.parent === a.scene;
      h.hit = { record: r2 };
      a.input.beginGrab(h);
      const grabSelected = a.interaction.selected === r2.data.id;
      a.input.endGrab(h);
      a.ui.group.visible = true;
      a.ui.group.updateMatrixWorld(true);
      h.hit = { prototype: "point" };
      a.interaction.select(r1.data.id);
      const count = a.lights.records.size;
      a.input.beginGrab(h);
      const created =
        a.lights.records.size === count + 1 &&
        a.interaction.selected === a.input.grabs.get(h).data.id;
      const newRecord = a.input.grabs.get(h);
      a.lights.update();
      const live = newRecord.light.intensity === 20;
      h2.hit = { record: newRecord };
      a.input.beginGrab(h2);
      const singleOwner = !a.input.grabs.has(h2);
      a.interaction.select(null);
      h.controller.dispatchEvent({ type: "squeezeend" });
      const releaseDoesNotSelect = a.interaction.selected === null;
      a.interaction.select(newRecord.data.id);
      a.ui.refresh();
      const propertiesShown = a.ui.panels[2].rows.some(
        (row) => row.label === "Intensity",
      );
      a.ui.group.visible = false;
      // Exercise actual select events and raycasting from the right controller.
      h.source = { handedness: "right" };
      h.controller.visible = true;
      h.controller.position
        .copy(r1.root.position)
        .add(new T.Vector3(0, 0, 0.5));
      h.controller.rotation.set(0, 0, 0);
      h.controller.updateMatrix();
      h.controller.updateMatrixWorld(true);
      h.controller.dispatchEvent({ type: "selectstart" });
      const triggered = a.interaction.selected === r1.data.id;
      h.controller.dispatchEvent({ type: "selectend" });
      a.ui.group.visible = true;
      a.ui.place();
      const panelPosition = a.ui.group.position.clone();
      const eye = a.viewCamera().getWorldPosition(new T.Vector3()),
        heading = a.viewCamera().getWorldDirection(new T.Vector3());
      heading.y = 0;
      heading.normalize();
      const panelHeading = panelPosition.clone().sub(eye);
      panelHeading.y = 0;
      panelHeading.normalize();
      const angle45 =
        Math.abs(heading.angleTo(panelHeading) - Math.PI / 4) < 1e-6;
      const panel = a.ui.panels[0],
        toggleIndex = panel.rows.findIndex(
          (r) => r.label === "Ambient enabled",
        ),
        target = panel.mesh.localToWorld(
          new T.Vector3(
            0.2,
            (0.5 - (106 + toggleIndex * 54 + 26) / 1536) * 1.68,
            0,
          ),
        );
      const panelQ = panel.mesh.getWorldQuaternion(new T.Quaternion()),
        normal = new T.Vector3(0, 0, 1).applyQuaternion(panelQ);
      h.controller.position.copy(
        a.rig.worldToLocal(target.clone().addScaledVector(normal, 0.5)),
      );
      h.controller.quaternion.copy(
        a.rig.getWorldQuaternion(new T.Quaternion()).invert().multiply(panelQ),
      );
      h.controller.updateMatrix();
      h.controller.updateMatrixWorld(true);
      const wasSelected = a.interaction.selected,
        wasAmbient = a.settings.ambientEnabled;
      h.controller.dispatchEvent({ type: "selectstart" });
      h.controller.dispatchEvent({ type: "selectend" });
      const uiPreservesSelection =
        a.interaction.selected === wasSelected &&
        a.settings.ambientEnabled !== wasAmbient;
      const row = panel.rows.findIndex((r) => r.label === "Tone mapping");
      a.ui.activate({ index: 0, row, control: panel.rows[row], x: 400 });
      const dropdownExpanded =
        panel.rows.filter(
          (r) => r.kind === "button" && r.label.startsWith("  "),
        ).length === 3;
      a.ui.openMenu = null;
      a.ui.refresh();
      a.rig.position.x += 1;
      a.scene.updateMatrixWorld(true);
      const stationary = a.ui.group.position.distanceTo(panelPosition) < 1e-6;
      a.ui.place();
      const repositioned = a.ui.group.position.distanceTo(panelPosition) > 0.1;
      a.ui.group.visible = false;
      return {
        preserved,
        selectedPreserved,
        moved,
        released,
        grabSelected,
        created,
        live,
        singleOwner,
        releaseDoesNotSelect,
        propertiesShown,
        triggered,
        angle45,
        uiPreservesSelection,
        dropdownExpanded,
        stationary,
        repositioned,
      };
    });
    for (const [key, value] of Object.entries(grabs)) assert(value, key);
    await page.getByRole("button", { name: "Save Scene", exact: true }).click();
    const saved = await page.evaluate(() => sceneTest.snapshot());
    await page
      .getByRole("button", { name: "Reset Scene", exact: true })
      .click();
    assert.equal(
      (await page.evaluate(() => sceneTest.snapshot())).lights.length,
      0,
    );
    await page.reload();
    await page.waitForFunction(() => window.sceneTest);
    await page.evaluate(() => sceneTest.app.renderer.setAnimationLoop(null));
    const restored = await page.evaluate(() => sceneTest.snapshot());
    assert.equal(restored.lights.length, saved.lights.length);
    restored.lights.forEach((light, i) => {
      const expected = saved.lights[i];
      light.rotation.forEach((v, j) =>
        assert(Math.abs(v - expected.rotation[j]) < 1e-10),
      );
      assert.deepEqual(
        { ...light, rotation: [] },
        { ...expected, rotation: [] },
      );
    });
    assert.deepEqual(restored.settings, saved.settings);
    assert.equal(restored.selected, null);
    const helpers = await page.evaluate(() => {
      const a = sceneTest.app;
      const r = [...a.lights.records.values()][0];
      r.data.enabled = false;
      a.lights.apply(r);
      a.interaction.select(r.data.id);
      a.ui.refresh();
      return { visible: r.root.visible, intensity: r.light.intensity };
    });
    assert.deepEqual(helpers, { visible: true, intensity: 0 });
    await page
      .getByRole("button", { name: "Delete light", exact: true })
      .click();
    assert.equal(
      (await page.evaluate(() => sceneTest.snapshot())).lights.length,
      saved.lights.length - 1,
    );
    assert.equal(
      (await page.evaluate(() => sceneTest.snapshot())).selected,
      null,
    );
    await page.evaluate(() => {
      const a = sceneTest.app;
      a.interaction.select(null);
      a.ui.refresh();
      a.renderer.render(a.scene, a.camera);
    });
    if (process.env.SCENE_SCREENSHOT)
      await page.screenshot({ path: process.env.SCENE_SCREENSHOT });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: WebGL startup, four light types, desktop controls, shadows/maps, oriented targets, area dimensions, selection/grab semantics, world panels, explicit save/reload/reset, disabled helpers and deletion.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
