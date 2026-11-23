import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  empresa?: string
  numero?: string
  serie?: string
  chave?: string
  xmlUrl?: string
  danfeUrl?: string
}

const colors = { paper: '#ffffff', ink: '#24372e', brand: '#1a3c2e' }
const main = { backgroundColor: colors.paper, color: colors.ink, fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '600px' }
const link = { color: colors.brand }

function NotaAutorizada({ empresa, numero, serie, chave, xmlUrl, danfeUrl }: Props) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Documentos de NF-e autorizada{empresa ? ` — ${empresa}` : ''}.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text>Gestor Florestal</Text>
          <Heading>NF-e autorizada</Heading>
          {empresa && <Text>{empresa}</Text>}
          <Text>Nota: {numero || 'Não informado'} · Série: {serie || 'Não informada'}</Text>
          {chave && <Text style={{ overflowWrap: 'anywhere' }}>Chave de acesso: {chave}</Text>}
          {xmlUrl && <Text><Link href={xmlUrl} style={link}>Baixar XML autorizado</Link></Text>}
          {danfeUrl && <Text><Link href={danfeUrl} style={link}>Baixar DANFE</Link></Text>}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: NotaAutorizada,
  subject: 'Gestor Florestal · NF-e autorizada',
  displayName: 'NF-e autorizada para o contador',
  previewData: { empresa: 'Empresa demonstrativa', numero: '1501', serie: '1' },
} satisfies TemplateEntry