const h7OriginalGetContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:h7OriginalGetContext.call(this,kind,...args);};
