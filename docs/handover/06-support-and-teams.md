# Support and teams

## Support tickets

Users can contact Tazilla from:
- the website contact form,
- the corporate enquiry form,
- the app's support screens,
- dashboard support pages.

Each ticket is stored in `support_requests`. Replies are stored in `support_ticket_messages`.

## Who sees what

- The person who sent a ticket sees only their own tickets.
- Admins see every ticket.
- The web vendor/enterprise/business support pages filter by the signed-in user's id.
- The Expo app also filters explicitly by user id, so an admin account cannot accidentally see every thread in the customer app.

## Ticket fields

| Field | Meaning |
|---|---|
| `customer_id` | The logged-in account that owns the ticket; null for anonymous website forms |
| `requester_kind` | `customer`, `vendor`, `enterprise`, `business`, `admin`, `visitor` |
| `reference` | Generated ticket reference (not an email) |
| `subject`, `body` | The message content |
| `status` | Lifecycle status |

Old tickets may still have an email in `reference`. New ones use generated references.

## Team access

### Vendor staff

Page: `/vendor/staff`

Owner or manager can add a person with:
- full name,
- email,
- temporary password,
- role (`manager` or `redemption_staff`).

The account is created immediately and can log in at `/vendor/login`. Existing accounts are never overwritten — if the person already has a Tazilla account, contact support.

Only the owner can add another manager. Members can be removed or have their role changed (not the owner).

### Enterprise colleagues

Page: `/enterprise/settings` → Team access

Owner or manager can add a colleague with:
- full name,
- email,
- temporary password,
- role (`manager` or read-only `analyst`).

They can log in at `/enterprise/login`. Analysts cannot change anything.

### Admin users

Page: `/admin/team`

An admin can create another admin with a chosen email and password. Admin access is stored in `user_roles`.

## How account creation works

`web/lib/team-members.ts` calls Supabase Auth Admin `createUser` with `email_confirm: true`. This means the person does not need to confirm their email before logging in.

A database trigger automatically creates:
- a `profiles` row,
- a `customer` role row.

The server action then inserts the membership row and writes an audit entry. Passwords are never stored in application tables or logs.

## Notifications

Admins get notifications for new tickets and replies. Users get an in-app notification when an admin replies.
