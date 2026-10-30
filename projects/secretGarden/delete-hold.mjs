// A hold belongs to one press, hand and plant. Cancellation never retargets it.
export class DeleteHold {
  constructor() { this.cancel(); }
  cancel() { this.pending=null;this.progress=0; }
  update({pressed=false,down=false,id=null,hand=null},now) {
    if(pressed) { this.cancel();if(down&&id!==null)this.pending={id,hand,start:now}; }
    const p=this.pending;
    if(!p)return null;
    if(!down||id!==p.id||hand!==p.hand){this.cancel();return null;}
    this.progress=Math.max(0,Math.min(1,now-p.start));
    if(this.progress>=1){const deleted=p.id;this.cancel();return deleted;}
    return null;
  }
}
