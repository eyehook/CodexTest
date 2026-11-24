// Reusable segmented selection/tab row, independent of any project or effect registry.
export class ChoiceBar {
  constructor({options, getValue, onSelect, x=60, y=140, width=904, height=60, gap=8, vertical=false, font='28px sans-serif'}) {
    this.options=options;this.getValue=getValue;this.onSelect=onSelect;
    Object.assign(this,{x,y,width,height,gap,vertical,font});
  }
  optionAt(x,y) {
    if(!this.options.length || x<this.x || x>=this.x+this.width || y<this.y || y>this.y+this.height)return null;
    const axis=this.vertical?y-this.y:x-this.x;
    const size=(this.vertical?this.height:this.width)/this.options.length;
    const index=Math.floor(axis/size);
    if(axis-index*size>size-this.gap)return null;
    const option=this.options[index];
    return option && !(typeof option.disabled==='function'?option.disabled():option.disabled)?option:null;
  }
  activateAt(x,y) {
    const option=this.optionAt(x,y);if(!option)return false;
    if(option.id!==this.getValue())this.onSelect(option.id);
    return true;
  }
  draw(ctx,{selected='#31566a',button='#243342',text='#f1f6fa',muted='#b9c1c8'}={}) {
    if(!this.options.length)return;
    const width=this.vertical?this.width:this.width/this.options.length;
    const height=this.vertical?this.height/this.options.length-this.gap:this.height;
    this.options.forEach((option,index)=>{
      const x=this.x+(this.vertical?0:index*width);
      const y=this.y+(this.vertical?index*(height+this.gap):0);
      ctx.fillStyle=option.id===this.getValue()?selected:button;ctx.fillRect(x,y,width-(this.vertical?0:this.gap),height);
      ctx.fillStyle=(typeof option.disabled==='function'?option.disabled():option.disabled)?muted:text;ctx.font=this.font;ctx.fillText(option.label,x+18,y+height*2/3);
    });
  }
}
