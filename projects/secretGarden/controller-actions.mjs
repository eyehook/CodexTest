// Inputs contain rising edges, already filtered for current tracking.
export class ActiveController {
  constructor() { this.hand='right';this.enabled=true; }
  update(inputs) {
    const transfer=inputs.find(input=>(!this.enabled||input.hand!==this.hand)&&input.trigger);
    if(transfer) { this.hand=transfer.hand;this.enabled=true; return []; }
    const active=inputs.find(input=>input.hand===this.hand);
    if(!active) return [];
    if(active.grip){this.enabled=!this.enabled;return [];}
    if(!this.enabled)return [];
    const actions=[];
    if(active.trigger) actions.push('plant');
    if(active.first) actions.push('copy');
    if(active.second) actions.push('delete');
    return actions;
  }
}
