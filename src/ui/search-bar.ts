import { html, nothing } from 'lit';
import type { MdFilledTextField } from '@material/web/textfield/filled-text-field.js';
import { isSpeechRecognitionSupported, startSpeechRecognition, type SpeechSession } from '../data/speech.ts';
import { LightElement, defineElement } from './base.ts';
import { emit } from './events.ts';

/**
 * Custom search bar: 56dp pill around a Material Web filled text field, with a
 * leading search icon, a clear action and a working mic that degrades
 * gracefully (Material Web has no search component).
 */
export class M3SearchBar extends LightElement {
  static override properties = {
    value: { type: String },
    placeholder: { type: String },
    variant: { type: String },
    label: { type: String },
    listening: { state: true },
  };

  declare value: string;
  declare placeholder: string;
  declare variant: 'outlined' | 'filled';
  declare label: string;
  private declare listening: boolean;

  private session: SpeechSession | null = null;

  constructor() {
    super();
    this.value = '';
    this.placeholder = 'Search';
    this.variant = 'outlined';
    this.label = 'Search saved places';
    this.listening = false;
  }

  private fieldEl(): MdFilledTextField | null {
    return this.querySelector<MdFilledTextField>('md-filled-text-field');
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.session?.stop();
    this.session = null;
  }

  private onInput(event: Event): void {
    const target = event.target as MdFilledTextField;
    this.value = target.value ?? '';
    emit(this, 'search-change', { value: this.value });
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.value.length > 0) {
      event.stopPropagation();
      this.setValue('');
    }
  }

  private onSubmit(event: Event): void {
    event.preventDefault();
    emit(this, 'search-submit', { value: this.value.trim() });
  }

  private setValue(next: string): void {
    this.value = next;
    this.fieldEl()?.focus();
    emit(this, 'search-change', { value: next });
  }

  private toggleMic(): void {
    if (this.listening) {
      this.session?.stop();
      this.session = null;
      this.listening = false;
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      emit(this, 'speech-unavailable', {});
      return;
    }
    let startErrorReported = false;
    const session = startSpeechRecognition(
      {
        onResult: (transcript, isFinal) => {
          this.setValue(transcript);
          if (isFinal && transcript.length > 0) {
            emit(this, 'search-submit', { value: transcript });
          }
        },
        onError: (message) => {
          startErrorReported = true;
          this.listening = false;
          this.session = null;
          emit(this, 'app-notify', { message });
        },
        onEnd: () => {
          this.listening = false;
          this.session = null;
        },
      },
      document.documentElement.lang || undefined,
    );
    if (!session) {
      // A failed start has already told the user what went wrong; a different
      // null (no Web Speech API at all) still deserves the explanatory event.
      if (!startErrorReported) {
        emit(this, 'speech-unavailable', {});
      }
      return;
    }
    this.session = session;
    this.listening = true;
  }

  protected override render() {
    const hasValue = this.value.length > 0;
    return html`
      <form
        class="search-bar ${this.variant === 'filled' ? 'search-bar--filled' : ''}"
        role="search"
        @submit=${(event: Event) => this.onSubmit(event)}
      >
        <md-filled-text-field
          class="search-bar__field"
          type="search"
          autocomplete="off"
          placeholder=${this.placeholder}
          aria-label=${this.label}
          .value=${this.value}
          @input=${(event: Event) => this.onInput(event)}
          @keydown=${(event: KeyboardEvent) => this.onKeydown(event)}
        >
          <md-icon slot="leading-icon" aria-hidden="true">search</md-icon>
        </md-filled-text-field>
        ${hasValue
          ? html`<md-icon-button
              class="search-bar__clear"
              aria-label="Clear search"
              @click=${() => this.setValue('')}
            >
              <md-icon>close</md-icon>
            </md-icon-button>`
          : nothing}
        <md-icon-button
          class="search-bar__mic ${this.listening ? 'is-listening' : ''}"
          aria-label=${this.listening ? 'Stop voice search' : 'Search by voice'}
          aria-pressed=${this.listening ? 'true' : 'false'}
          @click=${() => this.toggleMic()}
        >
          <md-icon>${this.listening ? 'graphic_eq' : 'mic'}</md-icon>
        </md-icon-button>
      </form>
    `;
  }
}

defineElement('m3-search-bar', M3SearchBar);
