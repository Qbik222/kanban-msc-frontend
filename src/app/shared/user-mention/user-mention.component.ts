import { Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';

export interface UserMentionProfile {
  id: string;
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-user-mention',
  standalone: true,
  host: { class: 'inline-flex min-w-0 max-w-full items-center' },
  templateUrl: './user-mention.component.html',
})
export class UserMentionComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) user!: UserMentionProfile;
  @Input() size: 'sm' | 'md' = 'sm';

  @ViewChild('anchor') private anchor?: ElementRef<HTMLElement>;
  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;

  open = false;
  top = 0;
  left = 0;
  avatarFailed = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private listening = false;
  private readonly onRefit = () => this.place();

  get initial(): string {
    const name = this.user?.name?.trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  get avatarUrl(): string | null {
    const url = this.user?.avatarUrl?.trim();
    if (!url || this.avatarFailed) {
      return null;
    }
    return url;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const previous = changes['user']?.previousValue as UserMentionProfile | undefined;
    const next = changes['user']?.currentValue as UserMentionProfile | undefined;
    if (previous?.id !== next?.id || previous?.avatarUrl !== next?.avatarUrl) {
      this.avatarFailed = false;
    }
  }

  show(): void {
    this.clearHide();
    this.open = true;
    setTimeout(() => this.place());
  }

  scheduleHide(): void {
    this.clearHide();
    this.hideTimer = setTimeout(() => {
      this.open = false;
      this.unbind();
    }, 120);
  }

  onAvatarError(): void {
    this.avatarFailed = true;
  }

  ngOnDestroy(): void {
    this.clearHide();
    this.unbind();
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.open = false;
    this.unbind();
  }

  private place(): void {
    const anchor = this.anchor?.nativeElement;
    const panel = this.panel?.nativeElement;
    if (!this.open || !anchor || !panel) {
      return;
    }
    const margin = 8;
    const anchorRect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    let top = anchorRect.bottom + 4;
    if (top + height > window.innerHeight - margin) {
      const above = anchorRect.top - height - 4;
      top = above >= margin ? above : margin;
    }
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - margin - height);
    }
    let left = anchorRect.left;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width;
    }
    if (left < margin) {
      left = margin;
    }
    this.top = top;
    this.left = left;
    this.bind();
  }

  private bind(): void {
    if (this.listening) {
      return;
    }
    this.listening = true;
    window.addEventListener('resize', this.onRefit);
    document.addEventListener('scroll', this.onRefit, true);
  }

  private unbind(): void {
    if (!this.listening) {
      return;
    }
    this.listening = false;
    window.removeEventListener('resize', this.onRefit);
    document.removeEventListener('scroll', this.onRefit, true);
  }

  private clearHide(): void {
    if (this.hideTimer != null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
