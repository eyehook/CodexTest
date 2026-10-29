// Reusable segmented selection/tab row, independent of any project or effect registry.
export class ChoiceBar {
  constructor({options, getValue, onSelect, x=60, y=140, width=904, height=60, gap=8, font='28px sans-serif'}) {
    this.options=options;this.getValue=getValue;this.onSelect=onSelect;
    Object.assign(this,{x,y,width,height,gap,font});
  }
  optionAt(x,y) {
    if(!this.options.length || x<this.x || x>=this.x+this.width || y<this.y || y>this.y+this.height)return null;
    const width=this.width/this.options.length,index=Math.floor((x-this.x)/width);
    if(x-this.x-index*width>width-this.gap)return null;
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
    const width=this.width/this.options.length;
    this.options.forEach((option,index)=>{
      const x=this.x+index*width;
      ctx.fillStyle=option.id===this.getValue()?selected:button;ctx.fillRect(x,this.y,width-this.gap,this.height);
      ctx.fillStyle=(typeof option.disabled==='function'?option.disabled():option.disabled)?muted:text;ctx.font=this.font;ctx.fillText(option.label,x+18,this.y+this.height*2/3);
    });
  }
}
