# Screenshots

Real screenshots of the running stack with seeded demo data — no mockups.

| File | Screen | Captured as |
| --- | --- | --- |
| `01-login.png` | Sign in | — |
| `02-dashboard.png` | Operations dashboard | Supervisor |
| `03-maquinaria.png` | Fleet catalogue | Supervisor |
| `04-maquinaria-detalle.png` | Machine record | Supervisor |
| `05-mantenimiento.png` | Work orders | Supervisor |
| `06-orden-detalle.png` | Work-order execution (`EN_EJECUCION`, parts consumed) | Planificador |
| `07-repuestos.png` | Spare parts / inventory | Supervisor |
| `08-almacen.png` | Warehouse dispatch | Supervisor |
| `09-reportes.png` | Analytical reports | Supervisor |
| `10-auditoria.png` | Forensic audit log | Planificador |
| `11-usuarios.png` | Users and roles | Planificador |
| `12-dark-mode.png` | Dashboard, dark theme | Supervisor |
| `13-swagger.png` | OpenAPI docs at `:8000/docs` | — |

## Why two different roles

The **Planificador sees soft-deleted records by design** (`is_active = false`),
which is exactly the behaviour documented in the RBAC section — useful in the
product, unhelpful in a screenshot, since archived scratch rows appear beside
the live fleet. Operational screens are therefore captured as the **Supervisor**,
who only sees active records. `10-auditoria` and `11-usuarios` are
Planificador-only screens, so those are captured with that role.

## Demo data

Fictional. Six machines (Caterpillar, Komatsu, Volvo, JCB, Hyundai), seven spare
part references — two deliberately below their minimum so the alert sweep raises
`LOW_STOCK` — and three work orders covering all three lifecycle states, one of
them settled so the cost figures on the dashboard are real. Four accounts, one
per role.

No production data appears in any screenshot; everything was captured against
the local `docker compose` stack.

## Regenerating them

```bash
docker compose up -d --build
```

1. Create the first Planificador at http://localhost/setup-admin with the
   creation key `SGMM-CLAVE-ADMIN-2026`.
2. Create one account per role from the Users screen.
3. Seed a fleet, spare parts, and at least one work order in each state — settle
   one of them so costs and audit entries exist. Empty tables make useless
   screenshots.
4. Run the alert sweep (`POST /api/alerts/check`) so stock alerts appear.
5. Capture at 1440×900 with `deviceScaleFactor: 2`, devtools closed.

### Gotchas if you script this

- **Nothing in the UI links to `/mantenimiento/$id`.** The work-order detail
  route exists but is only reachable by typing the URL, so a click-through
  script will never find it — navigate directly.
- **JWKS is encrypted with `BETTER_AUTH_SECRET`.** If you change that secret
  after the first boot, `/api/auth/token` starts returning 500
  (`Failed to decrypt private key`). Clear the table — `DELETE FROM jwks;` — and
  restart the identity server so keys regenerate.
- **Better Auth validates the request Origin.** The browser enters through the
  web container on `:80`, so `BETTER_AUTH_URL` must be the web origin, not the
  identity server's own port.
