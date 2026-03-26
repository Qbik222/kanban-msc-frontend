# Socket.IO events (backend → frontend)

Цей документ описує **фактичні** події Socket.IO, які бекенд емітить зараз. Джерело істини — код у `src/events/events.gateway.ts` та місця, де викликаються `emit*` методи gateway.

## Rooms

- **`board:${boardId}`** — room для подій конкретної дошки.
  - Клієнт має спочатку надіслати `joinBoard`, після чого бек додає сокет у цю кімнату.
  - Усі події “оновлення дошки” емітяться в цю кімнату: `this.server.to("board:<id>").emit(...)`.

## Client → Server

### `joinBoard`

Підписати клієнта на room конкретної дошки.

- **payload**

```ts
{ boardId: string; token?: string }
```

- **перевірки на бекенді**
  - якщо `token` не переданий → `board:join_error` з `Unauthorized`
  - якщо JWT невалідний/прострочений → `board:join_error` з `Unauthorized`
  - якщо у користувача немає права `board:read` на цю дошку → `board:join_error` з `Forbidden`

## Server → Client

### `board:joined` (to client)

Підтвердження успішного підписання на дошку.

- **payload**

```ts
{ boardId: string }
```

### `board:join_error` (to client)

Помилка під час `joinBoard`.

- **payload**

```ts
{ message: 'Unauthorized' | 'Forbidden' }
```

## Server → Clients in room `board:${boardId}`

Нижче — події, які сервер емітить у room `board:${boardId}` (тобто отримають їх лише клієнти, які успішно виконали `joinBoard` для цієї дошки).

### `board:updated`

- **payload**: `BoardResponseDto`
- **коли емітиться**: після rename/оновлення дошки (`PATCH /boards/:id`)
- **де викликається**: `src/boards/boards.controller.ts` → `eventsGateway.emitBoardUpdated(board)`

### `board:deleted`

- **payload**: `BoardResponseDto`
- **коли емітиться**: після soft delete дошки (`DELETE /boards/:id`)
- **де викликається**: `src/boards/boards.controller.ts` → `eventsGateway.emitBoardDeleted(board)`

### `columns:updated`

- **payload**

```ts
{ boardId: string; columns: ColumnResponseDto[] }
```

- **коли емітиться**: після будь-якої зміни колонок, яка впливає на канбан-стан дошки:
  - create column (`POST /columns`)
  - reorder columns (`PATCH /columns/reorder`)
  - update column (`PATCH /columns/:id`)
  - delete column (`DELETE /columns/:id`)
- **де викликається**: `src/columns/columns.service.ts` → `eventsGateway.emitColumnsUpdated(boardId, columns)`

### `card:created`

- **payload**: `CardResponseDto`
- **коли емітиться**: після створення картки (`POST /cards`)
- **де викликається**: `src/cards/cards.service.ts` → `eventsGateway.emitCardCreated(boardId, card)`

### `card:updated`

- **payload**: `CardResponseDto`
- **коли емітиться**:
  - після оновлення картки (`PATCH /cards/:id`)
  - після видалення коментаря (`DELETE /cards/:id/comments/:commentId`) — бек емітить `card:updated` як найближчу існуючу подію синхронізації картки
- **де викликається**: `src/cards/cards.service.ts` → `eventsGateway.emitCardUpdated(boardId, card)`

### `card:moved`

Подія для drag-and-drop / переміщення / видалення картки. Бек емітить **повний снапшот дошки** для консистентності UI.

- **payload**: `BoardDetailsResponseDto` (full board snapshot)
- **коли емітиться**:
  - після move card (`PATCH /cards/:id/move`)
  - після delete card (`DELETE /cards/:id`) — щоб всі клієнти оновили стан колонок/порядку
- **де викликається**: `src/cards/cards.service.ts` → `eventsGateway.emitCardMoved(boardId, boardSnapshot)`

### `comment:added`

- **payload**: `CardResponseDto` (картка вже з оновленим масивом `comments`)
- **коли емітиться**: після додавання коментаря (`POST /cards/:id/comments`)
- **де викликається**: `src/cards/cards.service.ts` → `eventsGateway.emitCommentAdded(boardId, card)`

## Примітка про пріоритет джерела

Якщо десь у документації/AsyncAPI є розбіжності з іменами подій — пріоритет має реалізація в `src/events/events.gateway.ts`.

