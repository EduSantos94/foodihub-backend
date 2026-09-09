# Contributing - FoodiHub

Guia para contribuir no projeto FoodiHub.

## 🎯 Antes de Começar

1. Ler [README.md](../README.md) - Overview do projeto
2. Setup local - Seguir [SETUP.md](./SETUP.md)
3. Entender arquitetura - Ler [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🔄 Workflow de Contribuição

### 1. Create Feature Branch

```bash
# Do branch main/master
git checkout -b feature/nome-da-feature

# Convenções de nome:
# feature/user-authentication    - Nova feature
# fix/login-bug                  - Bug fix
# refactor/auth-service          - Refactor
# docs/api-documentation         - Documentação
```

### 2. Desenvolver Localmente

```bash
# Backend
cd backend
npm run dev

# Frontend (em outro terminal)
cd frontend
npm start

# Config/Docker (em outro terminal)
cd config
docker compose up -d
```

### 3. Commit com Mensagens Claras

```bash
# Formato recomendado
git commit -m "feat: add user authentication"
git commit -m "fix: resolve login token issue"
git commit -m "refactor: simplify store service"
git commit -m "docs: update API documentation"

# Evitar
git commit -m "updates"
git commit -m "fix stuff"
```

### 4. Push & Create Pull Request

```bash
# Push branch
git push origin feature/nome-da-feature

# Create PR
# Via GitHub / GitLab interface
# Ou:
gh pr create --title "Add user authentication" --body "Description"
```

### 5. Code Review & Merge

- Esperar aprovação de pelo menos 1 reviewer
- Resolver comentários/sugestões
- Squash commits se necessário
- Merge quando aprovado

---

## 📝 Código Style & Padrões

### Backend (TypeScript)

```typescript
// ✅ Bom
export class StoreService {
  private storeRepository: Repository<StoreModel>;

  async createStore(data: CreateStoreRequest): Promise<StoreResponse> {
    // Validação
    if (!data.name) {
      throw new Error('Name is required');
    }

    // Lógica
    const store = this.storeRepository.create(data);
    return await this.storeRepository.save(store);
  }
}

// ❌ Evitar
const createStore = async (data) => {
  // Sem tipos
  const store = await db.query('INSERT INTO stores...');
  return store;
};
```

**Guidelines**:
- Use tipos TypeScript sempre
- Validar inputs
- Throw errors com mensagens claras
- Seguir MVC pattern
- Comentar lógica complexa

### Frontend (React Native/TypeScript)

```typescript
// ✅ Bom
export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      const response = await api.post('/auth/login', { email, password });
      storeToken(response.token);
      navigation.navigate('Dashboard');
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <SafeAreaView>
      <TextInput value={email} onChangeText={setEmail} />
      <Button onPress={handleLogin} title="Login" />
      {error && <Text>{error}</Text>}
    </SafeAreaView>
  );
};

// ❌ Evitar
const login = () => {
  fetch('/login')
    .then(res => res.json())
    .then(data => navigate('home'));
};
```

**Guidelines**:
- Use tipos (interfaces/types)
- Componentes funcionais com hooks
- Tratar erros
- Acessibilidade (labels, a11y)

---

## 🧪 Testing (Se Configurado)

```bash
# Backend tests
cd backend
npm run test

# Frontend tests
cd frontend
npm run test

# Coverage
npm run test:coverage
```

**Convensão**:
- Um arquivo `.test.ts` por arquivo testado
- Cobertura mínima: 80%
- Test nomes descritivos

---

## 🚀 Performance & Boas Práticas

### Backend
- [ ] Queries otimizadas (índices, joins)
- [ ] Pagination em endpoints que retornam listas
- [ ] Caching onde apropriado (Redis)
- [ ] Error handling completo
- [ ] Validação de inputs

### Frontend
- [ ] Lazy loading de screens
- [ ] Memoization de componentes complexos
- [ ] Otimização de re-renders
- [ ] AsyncStorage para cache local
- [ ] Loading states

---

## 📚 Documentação

### Backend Endpoint Novo

Adicionar em `docs/API.md`:

```markdown
### Listar Stores

\`\`\`http
GET /api/stores?page=1&limit=10
Authorization: Bearer <token>
\`\`\`

**Response (200)**:
\`\`\`json
{
  "data": [...],
  "pagination": {...}
}
\`\`\`
```

### Frontend Screen Nova

Adicionar em `frontend/README.md`:

```markdown
#### Nova Screen

- Path: `app/screens/NovoScreen.tsx`
- Acesso: Via menu
- Requer: Autenticação
```

---

## 🔄 Process de Review

### Reviewer Checklist

- [ ] Código segue style guide
- [ ] Sem dependências desnecessárias
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Sem console.log() ou debug code
- [ ] Sem hardcoded values
- [ ] Sem security issues

### Author Checklist

- [ ] Testes passando
- [ ] Sem breaking changes
- [ ] Documentação atualizada
- [ ] Commit messages claras
- [ ] PR description completo

---

## 🔒 Security

- Nunca commit `.env` com valores reais
- Nunca expose API keys ou secrets
- Validar todos os inputs
- Usar HTTPS em produção
- SQL injection - Use parameterized queries
- XSS protection - Sanitize outputs

---

## 📋 Antes de fazer PR

```bash
# 1. Pull latest changes
git pull origin main

# 2. Rebase se necessário
git rebase origin/main

# 3. Build sem erros
npm run build

# 4. Tests passando
npm run test

# 5. Linter passando
npm run lint

# 6. Verificar tipos
tsc --noEmit
```

---

## 🐛 Encontrou um Bug?

1. Abrir issue com descrição clara
2. Incluir steps para reproduzir
3. Esperar assignment
4. Criar branch `fix/...`
5. Submeter PR com referência ao issue

---

## 💡 Sugestão de Feature?

1. Discutir em issue primeiro
2. Esperar aprovação
3. Implementar em branch `feature/...`
4. Documentar bem
5. Submeter PR

---

## 📞 Dúvidas?

- Slack/Discord: [Adicionar link]
- Issues: Abrir no repo relevante
- Documentação: Ver `docs/`

---

## 🎓 Recursos Úteis

- TypeScript: https://www.typescriptlang.org/docs/
- Express.js: https://expressjs.com/
- TypeORM: https://typeorm.io/
- React Native: https://reactnative.dev/
- Expo: https://docs.expo.dev/
- Docker: https://docs.docker.com/

---

**Obrigado por contribuir! 🚀**
