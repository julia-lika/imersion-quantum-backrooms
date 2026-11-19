// Painel de diagnóstico sem precisar do console: abra a página com ?debug ou aperte F2.
// Mostra o estado da locomoção e os últimos erros de JavaScript.
(() => {
  const errors = [];
  const keysSeen = new Set();
  let panel = null;
  let timer = null;

  const remember = (message) => {
    errors.push(String(message).slice(0, 160));
    if (errors.length > 4) errors.shift();
  };

  window.addEventListener('error', (event) => {
    const where = event.filename ? ` (${event.filename.split('/').pop()}:${event.lineno})` : '';
    remember(`${event.message}${where}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    remember(`promise: ${event.reason?.message || event.reason}`);
  });
  window.addEventListener('keydown', (event) => {
    keysSeen.add(event.code);
    if (event.code === 'F2') toggle();
  });

  function render() {
    let info;
    try {
      info = window.quantumDebug ? window.quantumDebug() : { aviso: 'player-locomotion NÃO registrou quantumDebug' };
    } catch (error) {
      info = { erro: error.message };
    }

    info.teclas_recebidas = [...keysSeen].slice(-6).join(' ') || 'nenhuma';
    info.mapa = window.quantumMapStats || 'ainda não renderizado';
    info.medicao = window.quantumMeasureStats || 'nenhuma medição ainda';
    info.jogo_ativo = window.quantumPlayer ? window.quantumPlayer.active : 'sem quantumPlayer';
    info.aframe = window.AFRAME ? window.AFRAME.version : 'NÃO CARREGOU';
    info.fisica = Boolean(window.quantumPhysics);
    info.gerador = typeof window.generateQuantumMap === 'function';

    panel.textContent = `${JSON.stringify(info, null, 1)}\n\nERROS:\n${errors.join('\n') || '(nenhum)'}`;
  }

  function toggle() {
    if (panel) {
      clearInterval(timer);
      panel.remove();
      panel = null;
      return;
    }

    panel = document.createElement('pre');
    panel.style.cssText = [
      'position:fixed', 'left:8px', 'bottom:8px', 'z-index:99999', 'margin:0',
      'max-width:46vw', 'max-height:60vh', 'overflow:auto', 'padding:8px 10px',
      'font:11px/1.35 monospace', 'color:#b6ffb0', 'background:rgba(0,0,0,.82)',
      'border:1px solid #3c5', 'white-space:pre-wrap', 'pointer-events:none',
    ].join(';');
    document.body.appendChild(panel);
    timer = setInterval(render, 250);
    render();
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).has('debug')) toggle();
  });
})();
