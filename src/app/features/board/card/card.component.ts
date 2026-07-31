import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Card } from '../../../models/board.models';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  @Input({ required: true }) card!: Card;
  @Output() clicked = new EventEmitter<void>();
}
