import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: 'acme-demo' } })
  if (!tenant) throw new Error('acme-demo tenant not found — run db:seed first')

  const category = await db.category.upsert({
    where: { name_tenantId: { name: 'Procédures', tenantId: tenant.id } },
    update: {},
    create: { name: 'Procédures', tenantId: tenant.id, color: '#1E4F8C' },
  })

  const docs = [
    {
      slug: 'acme-remboursement-client',
      title: 'Procédure : Remboursement client',
      tags: ['remboursement', 'service client'],
      body: [
        '# Remboursement client',
        '',
        'Cette procédure décrit les étapes pour traiter une demande de remboursement.',
        '',
        '## Étapes',
        '- Vérifier la preuve d’achat et la date de la transaction.',
        '- En dessous de 100 $, l’agent peut approuver directement.',
        '- Au-delà de 100 $, l’accord d’un responsable est requis avant de valider.',
        '- Enregistrer le remboursement dans le système et notifier le client.',
        '',
        '## À retenir',
        'Toujours citer la version approuvée de la politique en vigueur.',
      ].join('\n'),
    },
    {
      slug: 'acme-ouverture-magasin',
      title: 'Guide : Ouverture du magasin',
      tags: ['opérations', 'quotidien'],
      body: [
        '# Ouverture du magasin',
        '',
        'Checklist à suivre chaque matin avant l’accueil des clients.',
        '',
        '## Checklist',
        '- Désactiver l’alarme et allumer les lumières.',
        '- Vérifier la caisse et le fond de caisse.',
        '- Contrôler les zones de sécurité et les sorties.',
        '- Confirmer que les prix affichés correspondent à la version du jour.',
      ].join('\n'),
    },
  ]

  for (const d of docs) {
    await db.kbArticle.upsert({
      where: { slug: d.slug },
      update: { title: d.title, body: d.body, tags: d.tags, isPublished: true, categoryId: category.id },
      create: {
        slug: d.slug,
        title: d.title,
        body: d.body,
        tags: d.tags,
        isPublished: true,
        tenantId: tenant.id,
        categoryId: category.id,
      },
    })
  }
  console.log(`KB seed complete: ${docs.length} documents for acme-demo.`)
}

main().finally(() => db.$disconnect())
