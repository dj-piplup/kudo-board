export async function paintPromise(img: HTMLElement): Promise<void> {
  let resolve: () => void;
  const didResize = new Promise<void>((r) => (resolve = r));
  const observer = new ResizeObserver((entries) => {
    if ((entries.at(-1)?.contentBoxSize[0]!.blockSize ?? 0) > 0) {
      resolve();
    }
  });
  observer.observe(img);
  await didResize;
  return;
}
