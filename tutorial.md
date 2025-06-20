
---

# 0. Why SuperTokens?

* **Single Docker command** to boot the core. ([supertokens.com][1])
* **EmailPassword + Session recipes** pre-built; bcrypt hashing & refresh logic handled for you. ([supertokens.com][2])
* Default session mode = **cookie-based with `HttpOnly` flag**, so JS can’t read tokens (protects untrusted school PCs). ([supertokens.com][3])

---

# 1 Prerequisites

| Tool          | Tested version |
| ------------- | -------------- |
| Node.js       | ≥ 18 LTS       |
| npm           | ≥ 10           |
| Angular CLI   | ≥ 17           |
| Docker Engine | ≥ 24           |
| Git           | any            |

---

# 2 Spin up the SuperTokens Core

```bash
docker run -d -p 3567:3567 \
  --name st-core \
  registry.supertokens.io/supertokens/supertokens-postgresql:latest
# In-memory DB by default; perfect for demos.
# Visit http://localhost:3567/hello – should reply “Hello”.
```

The container exposes a REST API on `3567`; no further config needed for dev. ([supertokens.com][1])

---

# 3 Backend (API) — Express + SuperTokens SDK

## 3.1 Scaffold

```bash
mkdir backend && cd backend
npm init -y
npm i express cors cookie-parser supertokens-node
npm i -D ts-node typescript @types/express
npx tsc --init       # if you want TS
```

```text
backend/
├─ index.ts
└─ config/ (optional: env files, constants)
```

## 3.2 `index.ts`

```ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import supertokens from "supertokens-node";
import Session from "supertokens-node/recipe/session";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import { middleware, errorHandler } from "supertokens-node/framework/express";

supertokens.init({
  framework: "express",
  supertokens: {
    connectionURI: "http://localhost:3567",   // core we just ran
  },
  appInfo: {
    appName: "DemoApp",
    apiDomain: "http://localhost:3000",
    websiteDomain: "http://localhost:4200",
    apiBasePath: "/api",
    websiteBasePath: "/auth",
  },
  recipeList: [
    EmailPassword.init(),
    Session.init({   // cookie-based sessions by default
      cookieSecure: false,          // false for HTTP during dev
      cookieSameSite: "lax",
      sessionExpiredStatusCode: 401
    }),
  ],
});

const app = express();
app.use(cors({
  origin: "http://localhost:4200",
  credentials: true          // allow cookies over CORS
}));
app.use(cookieParser());
app.use(express.json());

// SuperTokens mid-chain
app.use(middleware());

// Example protected route
import { verifySession } from "supertokens-node/recipe/session/framework/express";
app.get("/api/profile", verifySession(), (req, res) => {
  const userId = req.session!.getUserId();
  res.json({ userId });
});

// SuperTokens error handler
app.use(errorHandler());

app.listen(3000, () => console.log("API listening on 3000"));
```

Everything above is \~70 lines; no crypto code, no JWT plumbing. ([supertokens.com][2])

## 3.3 Run

```bash
npx ts-node index.ts
# API live at http://localhost:3000
```

---

# 4 Frontend — Angular 17

## 4.1 Create project

```bash
ng new frontend --routing --style=css
cd frontend
npm i
```

## 4.2 Auth Service (`src/app/auth.service.ts`)

```ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  api = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  signup(email: string, password: string) {
    return this.http.post(
      `${this.api}/auth/signup`,   // SuperTokens auto-exposes /auth/*
      { email, password },
      { withCredentials: true }    // MUST include cookies
    );
  }

  signin(email: string, password: string) {
    return this.http.post(
      `${this.api}/auth/signin`,
      { email, password },
      { withCredentials: true }
    );
  }

  signout() {
    return this.http.post(
      `${this.api}/auth/signout`,  {},
      { withCredentials: true }
    );
  }

  profile() {
    return this.http.get(`${this.api}/profile`, { withCredentials: true });
  }
}
```

`withCredentials: true` tells Angular to *send* and *accept* HttpOnly cookies over XHR. Without it the browser drops the cookie. ([stackoverflow.com][4])

## 4.3 Interceptor (auto-add `withCredentials` & handle 401)

```ts
@Injectable()
export class CredsInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const cloned = req.clone({ withCredentials: true });
    return next.handle(cloned).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          // maybe redirect to /login
        }
        return throwError(() => err);
      })
    );
  }
}
```

Remember to provide it in `app.module.ts`.

## 4.4 Route guard / components

* **LoginComponent** – reactive form -> `authService.signin(...)`.
* **RegisterComponent** – ditto for signup.
* **DashboardComponent** – calls `authService.profile()` on `ngOnInit`; guard navigation if 401.

Since the token is in an HttpOnly cookie, the Angular code can’t read it directly. Instead the **presence of a valid cookie** is proven by calling `/profile`; failure = not logged in.

---

# 5 Dockerise the stack

## 5.1 `backend/Dockerfile`

```Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

*(If you keep TypeScript, run `tsc && node dist/index.js` in CMD or compile in a build stage.)*

## 5.2 `frontend/Dockerfile`

```Dockerfile
FROM node:18-alpine AS build
WORKDIR /src
COPY . .
RUN npm ci && npm run build -- --configuration production

FROM nginx:alpine
COPY --from=build /src/dist/frontend /usr/share/nginx/html
EXPOSE 80
```

## 5.3 `docker-compose.yml` (root folder)

```yaml
version: "3.9"
services:
  core:
    image: registry.supertokens.io/supertokens/supertokens-postgresql:latest
    ports: ["3567:3567"]

  api:
    build: ./backend
    environment:
      - SUPERTOKENS_CORE_URI=http://core:3567
      - PORT=3000
    depends_on: [core]
    ports: ["3000:3000"]

  web:
    build: ./frontend
    depends_on: [api]
    ports: ["4200:80"]
```

```bash
docker compose up --build
```

Visit:

* `http://localhost:4200` – Angular UI
* `http://localhost:3000/api/profile` – returns 401 until logged in.

---

# 6 Statelessness Checklist

| Risk                              | Mitigation in this setup                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| **Token theft via XSS**           | Token never touches JS (HttpOnly cookie). ([supertokens.com][3])                         |
| **Left-over creds on shared PCs** | No `maxAge` by default ⇒ session cookie dies on browser close.                           |
| **CSRF**                          | SuperTokens embeds anti-CSRF tokens in a *second* cookie & header pair (handled by SDK). |
| **Refresh token abuse**           | SuperTokens rotates refresh tokens automatically; set short access-token TTL if needed.  |
| **MITM**                          | Use HTTPS in production (`cookieSecure: true`).                                          |

---

# 7 Troubleshooting

| Symptom                                        | Fix                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cookies not sent                               | Ensure **both** `withCredentials: true` on Angular requests **and** `Access-Control-Allow-Credentials: true` header on Express CORS. ([stackoverflow.com][4])           |
| 401 on first `/profile` call after page reload | Your interceptor hits the endpoint *before* refresh finished. Call SuperTokens’ built-in `/auth/session/refresh` first, or wait for Angular to finish `signin` promise. |
| Want persistent login on personal devices      | Set `session.expiredTime` and `cookie.maxAge` explicitly.                                                                                                               |

---

# 8 Next Steps

* Switch to **production Postgres** by passing `POSTGRESQL_CONNECTION_URI` to the core container.
* Add **email verification** (`EmailVerification` recipe).
* Customize UI or host SuperTokens’ ready-made React screens in an iframe.
* Consider **role-based access** via your own tables, fetched after `profile` call.

---

## You’re done!


* **Signup, login, logout, session refresh**
* **Zero credential storage in browser**
* **Dockerised** dev/prod parity


[1]: https://supertokens.com/docs/deployment/self-hosting/with-docker "Self-host SuperTokens | SuperTokens Docs"
[2]: https://supertokens.com/docs/quickstart/backend-setup "Backend Setup | SuperTokens Docs"
[3]: https://supertokens.com/docs/post-authentication/session-management/advanced-workflows/switch-between-cookies-and-header-authentication "Switch between cookie and header-based sessions | SuperTokens Docs"
[4]: https://stackoverflow.com/questions/59616290/angular-httpclient-does-not-send-domain-cookie/59617084 "Angular HttpClient does not send domain cookie - Stack Overflow"
