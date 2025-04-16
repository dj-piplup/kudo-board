import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  css,
  html,
  nothing,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import DOMPurify from "dompurify";
import { parse as parseMarkdown } from "marked";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

/**
 * Kudoboard element
 * @property kudos The kudos data as an array of objects
 */
@customElement("nimi-kudoboard")
export class NimiKudoboard extends LitElement {
  @property()
  kudos: Kudo[] = [];

  @property()
  columnCount: number = 3;

  @state()
  columns: Kudo[][] = [];

  #lastKudo: number = -1;
  #lastCol: number = -1;

  #cache: Record<number, { columns: Kudo[][]; lastKudo: number }> = {};

  protected willUpdate(_changedProperties: PropertyValues): void {
    if (_changedProperties.has("kudos")) {
      this.#cache = {};
      this.columns = [];
      this.#lastKudo = -1;
    }
    if (_changedProperties.has("columnCount")) {
      if (this.columns.length) {
        this.#cache[this.columns.length] = {
          columns: this.columns,
          lastKudo: this.#lastKudo,
        };
      }
      // If we changed the column count, redo the logic
      if (this.columnCount in this.#cache) {
        this.columns = this.#cache[this.columnCount].columns;
        this.#lastKudo = this.#cache[this.columnCount].lastKudo;
      } else {
        this.columns = [];
        this.#lastKudo = -1;
      }
    }
    if (this.columns.length === 0 && this.kudos.length > 0) {
      for (let i = 0; i < this.columnCount; i++) {
        this.columns.push([{ ...this.kudos[i], tabIndex: i + 1 }]);
      }
      this.#lastKudo = this.columnCount - 1;
      this.#lastCol = this.columnCount - 1;
    }
  }

  protected async updated(_changedProperties: PropertyValues): Promise<void> {
    if (this.kudos.length === 0 || this.#lastKudo === this.kudos.length - 1) {
      return;
    }
    const domCols = this.renderRoot.querySelectorAll(".column");
    // If the last thing we popped in was an image, we have to wait for its size to populate before we can count column heights
    if ((this.kudos[this.#lastKudo].art?.length ?? 0) > 0) {
      const lastEl = domCols[this.#lastCol].lastElementChild;
      const img = lastEl!.querySelector("img")!;
      let resolve: () => void;
      const didResize = new Promise<void>((r) => (resolve = r));
      const observer = new ResizeObserver((entries) => {
        if ((entries.at(-1)?.contentBoxSize[0]!.blockSize ?? 0) > 0) {
          resolve();
        }
      });
      observer.observe(img);
      await didResize;
    }
    let minHeight: number;
    let idx = 0;
    if (domCols.length > 1) {
      domCols.forEach((col, i) => {
        const height = col.getBoundingClientRect().height;
        if (minHeight === undefined || height < minHeight) {
          minHeight = height;
          idx = i;
        }
      });
    }

    const nextIdx = this.#lastKudo + 1;
    this.columns[idx].push({ ...this.kudos[nextIdx], tabIndex: nextIdx + 1 });
    this.#lastCol = idx;
    this.#lastKudo = nextIdx;
      // Lit will complain about this in dev mode because it's "inefficient"
      // However, we need to know what the rendered dom looks like between each kudo to properly place the next masonry item
      this.requestUpdate();
  }

  processMessage(markdown: string) {
    const parsed = parseMarkdown(markdown, { async: false });
    const bumpHeadersDown = parsed.replace(
      /<h(\d)/,
      (og: string, level: string) => (~~level < 6 ? `<h${~~level + 1}` : og)
    );
    const sanitized = DOMPurify.sanitize(bumpHeadersDown);
    return unsafeHTML(sanitized);
  }

  render() {
    return html`
      ${map(
        this.columns,
        (col, idx) =>
          html`<section part="column" class="column" col-order=${idx}>
            ${map(col, this.renderKudo)}
          </section>`
      )}
    `;
  }

  renderKudo = (data: Kudo) => {
    const img = data.art
      ? html`<img src=${data.art} part="card-image" />`
      : nothing;
    return html`
      <article tabindex=${data.tabIndex} part='card'>
        ${img}
        <section part='card-content'>
          <div part='card-text'>${this.processMessage(data.message)}</div>
          <div part='card-info'>
            <p part='card-name'>${data.name}</p>
          </div>
        <section>
      </article>
    `;
  };

  static styles?: CSSResultGroup | undefined = css`
    :host {
      display: grid;
      column-gap: 1rem;
      grid-auto-flow: column;
      grid-auto-columns: minmax(auto, 500px);
      grid-template-rows: 1fr;
      padding-top: 1rem;
      padding-inline: 1rem;
      align-items: flex-start;
      justify-content: center;
      overflow-x: hidden;
      overflow-y: auto;
    }
    .column {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    :host::part(card-text) {
      font-size: 1.1rem;
      & > :is(h1) {
        font-size: 1.3rem;
      }
      & > :is(h2) {
        font-size: 1.2rem;
      }
      & > :is(h3) {
        font-size: 1.15rem;
      }
      & > :is(p, h1, h2, h3, h4) {
        margin-block-start: 0;
        margin-block-end: 0.5rem;
      }
    }
    :host::part(card-content) {
      padding: 1rem;
    }
    :host::part(card-info) {
      display: flex;
      justify-content: flex-end;
      height: 0.9rem;
      & > p {
        margin: 0;
      }
    }
    :host::part(card-name) {
      font-size: 0.9rem;
      color: color-mix(in hsl, var(--card-text, black), white 50%);
    }
    :host::part(card-image) {
      width: 100%;
      border-radius: var(--card-roundness, 0.5rem) var(--card-roundness, 0.5rem)
        0 0;
    }
    article {
      background-color: var(--card-color, white);
      color: var(--card-text, black);
      border-radius: var(--card-roundness, 0.5rem);
      padding: 0;
      margin: 0;
      box-shadow: 0 3px 6px #0003,0 3px 6px #0004
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "nimi-kudoboard": NimiKudoboard;
  }
}

interface Kudo {
  timestamp: string | number;
  name: string;
  message: string;
  tabIndex?: number;
  art?: string;
}
