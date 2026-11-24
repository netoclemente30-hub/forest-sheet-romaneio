$ErrorActionPreference = 'Stop'
$destino = Join-Path $PSScriptRoot 'fontes'
New-Item -ItemType Directory -Force $destino | Out-Null
$catalogo = 'https://www.sedam.ro.gov.br/codef'
Invoke-WebRequest -Uri $catalogo -OutFile (Join-Path $destino 'sedam-codef.html')
$html = Get-Content -Raw (Join-Path $destino 'sedam-codef.html')
$links = [regex]::Matches($html, '/ext-files/[^"\\]+\.pdf') | ForEach-Object { $_.Value } | Sort-Object -Unique
$selecoes = @(
  @{ nome='ro-tr14-pmfs-poa'; filtro='TR 14-'; escopo='Documentação PMFS/POA; requisitos do projeto' },
  @{ nome='ro-tr13-monitoramento'; filtro='TR 13-'; escopo='Relatório de monitoramento florestal' },
  @{ nome='ro-decreto23481-2018'; filtro='23.481'; escopo='Procedimentos técnicos para PMFS em Rondônia' },
  @{ nome='ro-in04-2025'; filtro='SEDAM-no-04-2025'; escopo='TRMFM eletrônico' },
  @{ nome='ro-in11-2025'; filtro='SEDAM-no-11-de-07'; escopo='AUTEX e CAR' },
  @{ nome='ro-portaria137-2024'; filtro='137  de'; escopo='Gestão florestal estadual' },
  @{ nome='ro-portaria499-2022'; filtro='499 de'; escopo='Calendário florestal' },
  @{ nome='federal-inmma05-2006'; filtro='MMA Nº 5_2006'; escopo='Elaboração, execução e avaliação de PMFS na Amazônia Legal' },
  @{ nome='federal-conama406-2009'; filtro='CONAMA Nº 406,'; escopo='Parâmetros técnicos de manejo madeireiro no Bioma Amazônia' },
  @{ nome='federal-manual-sinaflor-inventario'; filtro='7.Manual SINAFLOR'; escopo='Preenchimento POA e importação do inventário 100%; manual, não norma' }
)
$extras = @(
  @{ nome='federal-lei12651-compilada'; url='https://www2.camara.leg.br/legin/fed/lei/2012/lei-12651-25-maio-2012-613076-normaatualizada-pl.html'; extensao='html'; escopo='Código Florestal: vegetação nativa, APP, RL, CAR e manejo'; vigencia='Texto atualizado oficial; vigente com alterações. Verificar artigos aplicáveis e decisões judiciais.' },
  @{ nome='federal-decreto5975-compilado'; url='https://www2.camara.leg.br/legin/fed/decret/2006/decreto-5975-30-novembro-2006-547239-normaatualizada-pe.pdf'; extensao='pdf'; escopo='Manejo, exploração e reposição florestal'; vigencia='Texto atualizado oficial; aplicabilidade de cada dispositivo deve ser confrontada com legislação posterior.' },
  @{ nome='ibama-manejo'; url='https://www.gov.br/ibama/pt-br/assuntos/biodiversidade/flora-e-madeira/manejo-florestal-sustentavel'; extensao='html'; escopo='Competência federal e lista de normas de manejo; página informativa'; vigencia='Não é ato normativo.' },
  @{ nome='xendra-contratacao-pncp'; url='https://pncp.gov.br/api/pncp/v1/orgaos/04092680000171/compras/2026/138'; extensao='json'; escopo='Evidência pública de contratação Xendra; não é manual técnico'; vigencia='Não se aplica.' }
)
$itens = foreach ($s in $selecoes) {
  $link = $links | Where-Object { $_.Contains($s.filtro) } | Select-Object -First 1
  if (!$link) { throw "Fonte não encontrada: $($s.nome)" }
  @{ nome=$s.nome; url=([uri]($catalogo.Replace('/codef','') + $link)).AbsoluteUri; extensao='pdf'; escopo=$s.escopo; vigencia='Listado no catálogo oficial consultado; vigência consolidada, alterações e revogações pendentes de validação. Não habilitar regras automáticas.' }
}
$manifesto = foreach ($item in @($itens) + $extras) {
  $arquivo = "$($item.nome).$($item.extensao)"
  $caminho = Join-Path $destino $arquivo
  try {
    Invoke-WebRequest -Uri $item.url -OutFile $caminho -TimeoutSec 45
    if ($item.extensao -eq 'pdf') {
      $bytes = [System.IO.File]::ReadAllBytes($caminho)
      if ([Text.Encoding]::ASCII.GetString($bytes, 0, [Math]::Min(5,$bytes.Length)) -ne '%PDF-') { throw 'Resposta não é PDF' }
    }
    $status = 'baixado'
    $hash = (Get-FileHash -LiteralPath $caminho -Algorithm SHA256).Hash
  } catch { $status = "falhou: $($_.Exception.Message)"; $hash = $null }
  [pscustomobject]@{ titulo=$item.nome; arquivo=$arquivo; url=$item.url; consultadoEm=[DateTimeOffset]::UtcNow.ToString('o'); escopo=$item.escopo; vigencia=$item.vigencia; status=$status; sha256=$hash }
}
$manifesto | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $PSScriptRoot 'fontes.json') -Encoding utf8
$linhas = @('# Índice das fontes', '', 'Consulta: 24/11/2026. Recorte inicial, não exaustivo. Downloads preservam originais; hashes em fontes.json. Presença no catálogo não prova vigência consolidada. Não aplicar automaticamente limites ou permissões com base neste índice.', '', '| Fonte | Escopo | Vigência / ressalva | Download |', '| --- | --- | --- | --- |')
foreach ($m in $manifesto) { $linhas += "| [$($m.titulo)]($($m.url)) | $($m.escopo) | $($m.vigencia) | [$($m.status)](fontes/$($m.arquivo)) |" }
$linhas | Set-Content (Join-Path $PSScriptRoot 'FONTES.md') -Encoding utf8
$manifesto | Select-Object titulo,status
