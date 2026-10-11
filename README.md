# Timer

Timer pessoal de treino, sem dependências, pronto para hospedagem estática na Vercel.

## Executar localmente

Instale Node.js e execute `npm run dev`. Abra http://localhost:5173. Execute `npm test` para verificar as regras do treino.

## Publicar

Envie os arquivos para um repositório na sua conta pessoal do GitHub. Na Vercel, importe o repositório, selecione o preset **Other**, deixe o build sem comando e use a raiz como diretório de saída. Não há dependências nem variáveis de ambiente. O servidor `server.js` é apenas para desenvolvimento local.

Abra o endereço HTTPS publicado no iPhone. No Safari, Compartilhar → Adicionar à Tela de Início. Teste os bipes junto com a música e confirme que a tela permanece acesa durante o treino.

## Funcionamento

- Em **Testar som**, ouça Digital, Suave, Arcade e Sino. Cada opção tem testes separados de contagem (cinco bipes), fim do bloco e conclusão do treino. **Usar este som** salva uma escolha única para todos os treinos neste navegador, inclusive offline.

- Treino inicial: 40s de exercício, 20s de descanso, 8 rounds, 4 séries, 120s entre séries e 5s de preparação. Total: 36:45 incluindo preparação.
- Descanso longo substitui o descanso curto no último round. Nenhum descanso após o último exercício.
- Bipes curtos nos últimos cinco segundos de cada etapa, agendados pelo relógio de áudio a partir do mesmo prazo da contagem visual. Etapas curtas usam os segundos disponíveis.
- Um bip mais agudo e longo marca a troca de etapa; três notas ascendentes marcam a conclusão. O controle de som silencia todos os avisos. Pausar cancela os sons agendados, e continuar agenda os segundos restantes.
- Ao sair da tela, o treino pausa; retome manualmente. Chamadas e interrupções do sistema precisam de validação no aparelho.
- Treinos ficam no localStorage desse navegador, sem sincronização. Apagar os dados remove os treinos.
- O service worker salva os arquivos para uso offline após o primeiro carregamento completo. Os bipes são gerados no aparelho, sem arquivos externos.
- Wake Lock é solicitado durante o treino. O sistema pode recusá-lo ou liberá-lo. O status aparece na tela.
- Música e avisos sonoros podem interagir de maneira diferente no iPhone; esse comportamento ainda precisa de validação no aparelho.

## Atualizações

Ao mudar arquivos publicados, altere também a versão `CACHE` em `sw.js`. A nova versão aguarda aprovação na tela inicial e não é ativada durante uma sessão de treino. Mantenha o mesmo domínio para preservar os treinos salvos.

## Escopo

Sem contas, estatísticas, histórico, compartilhamento ou sincronização. Nome do projeto: Timer.
