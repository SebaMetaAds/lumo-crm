import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad | Lumo CRM',
  description: 'Política de privacidad de Lumo CRM.'
}

export default function PrivacyPage(){
  return <main style={{maxWidth:900,margin:'0 auto',padding:'56px 24px 80px',fontFamily:'Inter,system-ui,sans-serif',color:'#17202a',lineHeight:1.65}}>
    <div style={{marginBottom:36}}>
      <div style={{display:'inline-flex',alignItems:'center',gap:10,marginBottom:16}}><div style={{width:38,height:38,borderRadius:12,display:'grid',placeItems:'center',background:'linear-gradient(145deg,#8169dc,#6549c5)',color:'#fff',fontWeight:800}}>L</div><strong style={{fontSize:20}}>Lumo CRM</strong></div>
      <h1 style={{fontSize:38,lineHeight:1.15,margin:'0 0 10px'}}>Política de Privacidad</h1>
      <p style={{margin:0,color:'#6b7280'}}>Última actualización: 26 de agosto de 2026</p>
    </div>

    <section>
      <p>Lumo CRM es una plataforma de gestión de relaciones con clientes y mensajería omnicanal que permite a negocios autorizados centralizar conversaciones, contactos, oportunidades y tareas en un único espacio de trabajo.</p>
      <p>Esta Política de Privacidad explica qué información puede procesar Lumo CRM, con qué finalidad se utiliza, cómo se protege y qué opciones tienen los usuarios respecto de sus datos.</p>
    </section>

    <Section title="1. Información que procesamos">
      <p>Dependiendo de las funciones habilitadas y de las integraciones conectadas por el usuario, Lumo CRM puede procesar:</p>
      <ul>
        <li>Datos de cuenta y acceso, como nombre, correo electrónico e identificadores de usuario.</li>
        <li>Datos de clientes y contactos cargados por el negocio, como nombre, teléfono, correo electrónico, empresa y notas comerciales.</li>
        <li>Conversaciones y mensajes recibidos o enviados mediante canales conectados, incluyendo Instagram y otros servicios de mensajería compatibles.</li>
        <li>Identificadores técnicos necesarios para vincular cuentas, conversaciones y mensajes con servicios externos.</li>
        <li>Datos comerciales creados dentro de Lumo CRM, como oportunidades, tareas, actividades, productos y estados de seguimiento.</li>
        <li>Datos técnicos de funcionamiento, seguridad y diagnóstico necesarios para operar y proteger la plataforma.</li>
      </ul>
    </Section>

    <Section title="2. Integración con Instagram y Meta">
      <p>Cuando un usuario conecta una cuenta profesional de Instagram a Lumo CRM, la plataforma utiliza las APIs oficiales de Meta para permitir funciones autorizadas por el titular de esa cuenta.</p>
      <p>Esto puede incluir recibir mensajes enviados por usuarios de Instagram a la cuenta comercial conectada, mostrar esas conversaciones dentro del Inbox de Lumo CRM y permitir que usuarios autorizados del negocio respondan desde la plataforma.</p>
      <p>Lumo CRM no vende datos obtenidos a través de Meta y no utiliza el contenido de mensajes de Instagram para publicidad dirigida. Los datos se procesan únicamente para prestar las funcionalidades solicitadas por el negocio que conectó la cuenta.</p>
    </Section>

    <Section title="3. Finalidades del tratamiento">
      <p>La información procesada por Lumo CRM se utiliza para:</p>
      <ul>
        <li>Prestar y mantener las funciones del CRM.</li>
        <li>Centralizar y gestionar conversaciones con clientes.</li>
        <li>Permitir el seguimiento comercial y operativo de contactos y oportunidades.</li>
        <li>Enviar respuestas solicitadas por usuarios autorizados a través de canales conectados.</li>
        <li>Ejecutar automatizaciones configuradas por el negocio.</li>
        <li>Prevenir fraude, abuso, accesos no autorizados y fallas de seguridad.</li>
        <li>Diagnosticar errores y mejorar el funcionamiento del servicio.</li>
      </ul>
    </Section>

    <Section title="4. Base y control de los datos">
      <p>Los negocios que utilizan Lumo CRM determinan qué cuentas, contactos y canales conectan a la plataforma. Respecto de los datos de sus propios clientes, cada negocio es responsable de contar con las autorizaciones y bases legales que correspondan según la normativa aplicable.</p>
      <p>Lumo CRM procesa esos datos únicamente para prestar el servicio solicitado y conforme a las instrucciones del negocio usuario.</p>
    </Section>

    <Section title="5. Almacenamiento y seguridad">
      <p>Lumo CRM utiliza proveedores de infraestructura y almacenamiento para operar la plataforma. Se aplican medidas razonables de seguridad técnica y organizativa destinadas a proteger la información frente a acceso no autorizado, pérdida, alteración o divulgación indebida.</p>
      <p>Las credenciales sensibles de integraciones externas, como tokens de acceso, se almacenan de forma separada del contenido habitual de la aplicación y no se exponen a usuarios no autorizados.</p>
    </Section>

    <Section title="6. Proveedores y terceros">
      <p>Lumo CRM puede utilizar proveedores tecnológicos necesarios para prestar el servicio, incluyendo infraestructura de hosting, bases de datos, autenticación y APIs de canales conectados. Estos proveedores reciben únicamente la información necesaria para cumplir su función.</p>
      <p>Entre los servicios que pueden intervenir se encuentran Meta Platforms, Inc. para integraciones con Instagram, y proveedores de infraestructura utilizados para alojar y operar Lumo CRM.</p>
    </Section>

    <Section title="7. Conservación de datos">
      <p>Los datos se conservan mientras sean necesarios para prestar el servicio, mantener la cuenta activa, cumplir obligaciones legales o resolver disputas. Un negocio puede dejar de utilizar una integración o solicitar la eliminación de información cuando corresponda.</p>
    </Section>

    <Section title="8. Eliminación de datos y desconexión de Instagram">
      <p>Los usuarios pueden desconectar sus integraciones desde la configuración de Lumo CRM. También pueden solicitar la eliminación de datos asociados a su cuenta o a una integración enviando una solicitud al correo de contacto indicado al final de esta política.</p>
      <p>Cuando una integración de Instagram es desconectada, Lumo CRM deja de utilizar sus credenciales para recibir o enviar nuevos mensajes. Las solicitudes de eliminación serán atendidas conforme a las obligaciones legales y técnicas aplicables.</p>
    </Section>

    <Section title="9. Derechos de los usuarios">
      <p>Según la legislación aplicable, las personas pueden tener derechos de acceso, rectificación, actualización, eliminación, oposición o limitación respecto de sus datos personales. Las solicitudes pueden realizarse utilizando el canal de contacto indicado debajo.</p>
    </Section>

    <Section title="10. Cambios a esta política">
      <p>Podemos actualizar esta Política de Privacidad para reflejar cambios en Lumo CRM, en nuestras integraciones o en requisitos legales. La fecha de última actualización se indicará al comienzo de esta página.</p>
    </Section>

    <Section title="11. Contacto">
      <p>Para consultas sobre privacidad, solicitudes de acceso o eliminación de datos, podés contactarnos por correo electrónico en <a href="mailto:parraseba96@gmail.com" style={{color:'#684cc9'}}>parraseba96@gmail.com</a>.</p>
    </Section>

    <div style={{marginTop:44,paddingTop:22,borderTop:'1px solid #e5e7eb',fontSize:13,color:'#6b7280'}}>Lumo CRM · Política de Privacidad</div>
  </main>
}

function Section({title,children}:{title:string;children:React.ReactNode}){
  return <section style={{marginTop:32}}><h2 style={{fontSize:22,margin:'0 0 10px'}}>{title}</h2><div>{children}</div></section>
}
