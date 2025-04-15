export const createDistributor = ({minWidth, maxCount, onChange}: {minWidth: number, maxCount:number, onChange: (v:number)=>void}) => {
    let lastCount = 0
    return new ResizeObserver((entries) => {
        const newest = entries.at(-1);
        const width = newest?.borderBoxSize[0].inlineSize!;
        const columnCount = Math.min(Math.floor(width / minWidth), maxCount);
        if(columnCount !== lastCount){
            lastCount = columnCount;
            onChange(columnCount);
        }
    });
}