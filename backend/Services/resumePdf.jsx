import { renderToBuffer, Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

function section(title, children, accent) {
  if (!children) return null;
  return (
    <View style={styles.section} key={title}>
      <Text style={[styles.sectionTitle, accent ? { color: accent } : null]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, lineHeight: 1.4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerInfo: { flex: 1, paddingRight: 16 },
  photo: { width: 56, height: 56, borderRadius: 28, objectFit: 'cover' },
  name: { fontSize: 20, fontWeight: 700 },
  contact: { fontSize: 9, color: '#555', marginTop: 2 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 2 },
  row: { marginBottom: 5 },
  rowTitle: { fontWeight: 700 },
  rowMeta: { fontSize: 9, color: '#555' },
});

function ClassicTemplate({ r, accent, font }) {
  return (
    <Document>
      <Page size="A4" style={[styles.page, { fontFamily: font }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={[styles.name, { color: accent }]}>{r.personal?.fullName || 'Full Name'}</Text>
            <Text style={styles.contact}>
              {[r.personal?.email, r.personal?.phone, r.personal?.location].filter(Boolean).join(' • ')}
            </Text>
          </View>
          {r.personal?.photoUrl && (
            <Image src={r.personal.photoUrl} style={styles.photo} />
          )}
        </View>

        {r.personal?.careerObjective && (
          <Text style={{ marginTop: 4, marginBottom: 6 }}>{r.personal.careerObjective}</Text>
        )}

        {section('Experience', r.experience?.map((e, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.rowTitle}>{e.title} — {e.company}</Text>
            <Text style={styles.rowMeta}>{e.startDate} – {e.endDate || 'Present'}</Text>
            <Text>{e.description}</Text>
          </View>
        )), accent)}

        {section('Internships', r.internships?.map((e, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.rowTitle}>{e.role} — {e.company}</Text>
            <Text style={styles.rowMeta}>{e.startDate} – {e.endDate || 'Present'}</Text>
            <Text>{e.description}</Text>
          </View>
        )), accent)}

        {section('Projects', r.projects?.map((p, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.rowTitle}>{p.name}</Text>
            <Text>{p.description}</Text>
          </View>
        )), accent)}

        {section('Education', r.education?.map((e, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.rowTitle}>{e.degree} — {e.institution}</Text>
            <Text style={styles.rowMeta}>{e.startYear} – {e.endYear} {e.grade ? `• ${e.grade}` : ''}</Text>
          </View>
        )), accent)}

        {section('Skills', r.skills?.length ? <Text>{r.skills.join(' • ')}</Text> : null, accent)}
        {section('Certifications', r.certifications?.map((c, i) => (
          <Text key={i}>{c.name} — {c.issuer} ({c.year})</Text>
        )), accent)}
        {section('Achievements', r.achievements?.length ? r.achievements.map((a, i) => <Text key={i}>• {a}</Text>) : null, accent)}
        {section('Languages', r.languages?.length ? <Text>{r.languages.map(l => `${l.name} (${l.proficiency})`).join(', ')}</Text> : null, accent)}
        {section('Links', (r.socialLinks?.linkedin || r.socialLinks?.github || r.socialLinks?.portfolio) ? (
          <Text>{[r.socialLinks.linkedin, r.socialLinks.github, r.socialLinks.portfolio].filter(Boolean).join('  |  ')}</Text>
        ) : null, accent)}
        {section('References', r.references?.map((ref, i) => (
          <Text key={i}>{ref.name} — {ref.relation} — {ref.contact}</Text>
        )), accent)}
      </Page>
    </Document>
  );
}

function ModernTemplate({ r, accent, font }) {
  return <ClassicTemplate r={r} accent={accent} font={font} />;
}

function MinimalTemplate({ r, accent, font }) {
  return <ClassicTemplate r={r} accent="#111827" font={font} />;
}

const TEMPLATES = { classic: ClassicTemplate, modern: ModernTemplate, minimal: MinimalTemplate };

const VALID_FONTS = ['Helvetica', 'Times-Roman', 'Courier'];

export async function generateResumePdf(resumeDoc) {
  const Template = TEMPLATES[resumeDoc.template] || ClassicTemplate;
  const font = VALID_FONTS.includes(resumeDoc.fontFamily) ? resumeDoc.fontFamily : 'Helvetica';
  const element = <Template r={resumeDoc} accent={resumeDoc.themeColor || '#126b59'} font={font} />;
  return renderToBuffer(element);
}