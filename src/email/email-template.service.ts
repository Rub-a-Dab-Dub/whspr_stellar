import { Injectable } from '@nestjs/common';
import { EMAIL_TEMPLATE_REGISTRY } from './templates/email-template.registry';
import { EmailType } from './enums/email-type.enum';

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailTemplateService {
  render(
    type: EmailType,
    variables: Record<string, string | number | null | undefined>,
  ): RenderedTemplate {
    const template = EMAIL_TEMPLATE_REGISTRY[type];
    return {
      subject: this.renderHandlebars(template.subject, variables),
      html: this.renderHandlebars(template.html, variables),
      text: this.renderHandlebars(template.text, variables),
    };
  }

  private renderHandlebars(
    input: string,
    variables: Record<string, string | number | null | undefined>,
  ): string {
    return input.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
      const value = variables[key];
      return value === null || value === undefined ? '' : String(value);
    });
  }
}
