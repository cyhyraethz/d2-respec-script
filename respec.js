#!/usr/bin/env node
'use strict';

const fs = require('fs');

const args = process.argv;

const unspentOffset = 562; // must be set to 255 for unspent stat and skill points to show up
const newStatsOffset = 581; // number of unspent stat points
const newSkillOffset = 585; // number of unspent skill points
const firstSkillOffset = 619; // first class skill
const lastSkillOffset = 648; // last class skill

const getValue = (buffer, offset) => {
  return buffer[offset].toString(16).toUpperCase();
};

const resetSkills = (args, buffer) => {
  let unspentStats = 0;
  let unspentSkills = 0;
  switch (getValue(buffer, unspentOffset)) {
    case 'DF':
      unspentStats = parseInt(getValue(buffer, newStatsOffset), 16);
      break;
    case 'EF':
      unspentSkills = parseInt(getValue(buffer, newSkillOffset - 4), 16);
      break;
    case 'FF':
      unspentStats = parseInt(getValue(buffer, newStatsOffset), 16);
      unspentSkills = parseInt(getValue(buffer, newSkillOffset), 16);
      break;
  }
  if (!unspentStats) {
    let startBuffer = buffer.slice(0, newStatsOffset);
    let endBuffer = buffer.slice(newStatsOffset);
    buffer = Buffer.concat([startBuffer, Buffer.alloc(4), endBuffer]);
  }
  if (!unspentSkills) {
    let startBuffer = buffer.slice(0, newSkillOffset);
    let endBuffer = buffer.slice(newSkillOffset);
    buffer = Buffer.concat([startBuffer, Buffer.alloc(4), endBuffer]);
  }
  let unassignedSkills = 0;
  for (let i = firstSkillOffset; i <= lastSkillOffset; i++) {
    unassignedSkills += parseInt(getValue(buffer, i), 16);
    buffer[i] = parseInt('0', 16);
  }
  buffer[newSkillOffset] = unspentSkills + unassignedSkills;
  buffer[unspentOffset] = parseInt('FF', 16); // set to 255 to enable unspent stat and skill points
  fs.writeFile(args[2], buffer, (error) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Skill points have been unassigned.');
    }
  });
};

fs.readFile(args[2], (error, buffer) => {
  if (error) {
    return console.log(error);
  } else {
    resetSkills(args, buffer);
  }
});
