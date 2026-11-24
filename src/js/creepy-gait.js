// Andar assustador da entidade (o modelo não tem esqueleto nem animação, então
// tudo é procedural, no corpo inteiro): passos que mancam de um lado para o
// outro, tronco inclinado para a frente, tremor constante, espasmos rápidos de
// giro e congeladas súbitas, seguidas de uma arrancada para recuperar o atraso.
// Usado pela entidade do labirinto (quantum-ghost) e pela TV do lobby.
(function creepyGait() {
  const TAU = Math.PI * 2;
  const rand = (min, max) => min + Math.random() * (max - min);

  // Menor diferença entre dois ângulos, em radianos.
  function angleDelta(from, to) {
    return ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
  }

  function create(now = 0) {
    return {
      phase: 0,
      yaw: 0,
      lastTurn: 0,
      frozenUntil: 0,
      nextFreeze: now + rand(2500, 6000),
      twitch: 0,
      twitchUntil: 0,
      nextTwitch: now + rand(1500, 4000),
    };
  }

  // moving: está andando agora; targetYaw: para onde o corpo deve virar;
  // pace: 1 = normal, maior = caçando. Devolve a pose do corpo e se está
  // congelado (quem chama não avança a posição nesse tempo).
  function update(state, now, deltaMs, { moving, targetYaw, pace = 1 }) {
    const dt = Math.min(0.1, deltaMs / 1000);

    if (moving && now > state.nextFreeze) {
      state.frozenUntil = now + rand(280, 650);
      state.nextFreeze = now + rand(3000, 7000);
    }
    const frozen = now < state.frozenUntil;

    if (now > state.nextTwitch) {
      state.twitch = rand(0.25, 0.55) * (Math.random() < 0.5 ? -1 : 1);
      state.twitchUntil = now + rand(90, 180);
      state.nextTwitch = now + rand(1800, 5000);
    }
    const twitch = now < state.twitchUntil ? state.twitch : 0;

    // O corpo vira aos trancos: a cada ~110 ms dá um puxão de 45% do que falta.
    if (now - state.lastTurn > 110) {
      state.lastTurn = now;
      state.yaw += angleDelta(state.yaw, targetYaw) * (frozen ? 0.15 : 0.45);
    }

    if (moving && !frozen) state.phase += dt * 7.5 * pace;
    const step = Math.sin(state.phase);
    const tremor = frozen ? 0.05 : 0.018;
    const shake = () => (Math.random() - 0.5) * tremor;

    return {
      frozen,
      catchUp: moving && !frozen && now - state.frozenUntil < 900 ? 1.9 : 1,
      y: moving ? Math.abs(step) * 0.06 + (step > 0.95 ? -0.03 : 0) : 0,
      x: shake() * 0.6,
      yaw: state.yaw + twitch + shake(),
      // Inclinado para a frente, mancando de um lado para o outro.
      pitch: 0.14 + Math.abs(Math.sin(state.phase * 2)) * 0.05 + shake(),
      roll: step * 0.14 + shake(),
      // Estica e encolhe um pouco a cada passo.
      stretch: 1 + (moving ? Math.sin(state.phase * 2) * 0.025 : Math.sin(now * 0.002) * 0.01),
    };
  }

  function apply(object3D, pose) {
    object3D.rotation.order = 'YXZ';
    object3D.rotation.set(pose.pitch, pose.yaw, pose.roll);
    object3D.position.set(pose.x, pose.y, 0);
    object3D.scale.set(1, pose.stretch, 1);
  }

  window.creepyGait = { create, update, apply, angleDelta };
})();
