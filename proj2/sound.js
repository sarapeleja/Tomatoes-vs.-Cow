// sound.js

const moveAudio = new Audio('./audio/moving.mp3');
const shotAudio = new Audio('./audio/shot.mp3');
const emptyGunAudio = new Audio('./audio/empty-gun.mp3');
const splatAudio = new Audio('./audio/tomato-splat.mp3');
const sadAudio = new Audio('./audio/sad-cow.mp3');
const deadAudio = new Audio('./audio/dead-cow.mp3');
const gameAudio = new Audio('./audio/background.mp3');
const victoryAudio = new Audio('./audio/victory.mp3');

moveAudio.loop = true;
gameAudio.loop = true;

let isMuted = false;
let playing = false;

// Helper to safely replay an audio clip
function re_play(audio, start = 0) {
  audio.currentTime = start;
  audio.play();
}

// Toggle mute
function mute() {
  isMuted = !isMuted;
  [moveAudio, shotAudio, emptyGunAudio, splatAudio, sadAudio, deadAudio, gameAudio]
    .forEach(element => { element.muted = isMuted })

  if (isMuted)
    document.getElementById("mute").style.display = "block";
  else
    document.getElementById("mute").style.display = "none";
}

function playShot(tomatoCount) {
  if (tomatoCount > 0) re_play(shotAudio);
  else re_play(emptyGunAudio);
}

function playSplat() {
  re_play(splatAudio);
}

function playDeadCow() {
  sadAudio.pause(); //dont play both simultaneously
  re_play(deadAudio);
}

function playSadCow() {
  re_play(sadAudio);
}

//only replay if not playing
function playMove() {
  if (moveAudio.paused) re_play(moveAudio);
}

function stopMove() {
  moveAudio.pause();
}

function toggleGame() {
  playing = !playing;
  if (playing) re_play(gameAudio);
  else gameAudio.pause();
}

function endCelebration() {
  victoryAudio.pause();
}

function celebrate() {
  gameAudio.pause();
  re_play(victoryAudio, 16.5);
}

// Export all sound functions
export const Sound = {
  playShot,
  playSplat,
  toggleGame,
  playDeadCow,
  playSadCow,
  celebrate,
  endCelebration,
  playMove,
  stopMove,
  mute
};