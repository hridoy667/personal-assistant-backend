import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { globSync } from 'glob';
import { get } from 'lodash';
import type { MailerOptions } from '@nestjs-modules/mailer';

/**
 * Same as @nestjs-modules/mailer HandlebarsAdapter with CSS inlining off, but
 * does NOT import `@css-inline/css-inline` (Windows native .node often fails).
 * Use inline styles in .hbs (see email-verification.hbs).
 */
export class HandlebarsAdapterPlain {
  private readonly precompiledTemplates: Record<
    string,
    handlebars.TemplateDelegate
  > = {};

  constructor(helpers?: handlebars.HelperDeclareSpec) {
    handlebars.registerHelper('concat', (...args: unknown[]) => {
      args.pop();
      return (args as string[]).join('');
    });
    if (helpers) {
      handlebars.registerHelper(helpers);
    }
  }

  compile(
    mail: {
      data: { template: string; context: Record<string, unknown>; html?: string };
    },
    callback: (err?: Error) => void,
    mailerOptions: MailerOptions,
  ): void {
    const templateConfig = mailerOptions.template;

    const precompile = (
      template: string,
      onErr: (err: Error) => void,
      options: MailerOptions['template'],
    ):
      | {
          templateExt: string;
          templateName: string;
          templateDir: string;
          templatePath: string;
        }
      | undefined => {
      const templateBaseDir = get(options, 'dir', '') as string;
      const templateExt = path.extname(template) || '.hbs';
      let templateName = path.basename(template, path.extname(template));
      const templateDir = path.isAbsolute(template)
        ? path.dirname(template)
        : path.join(templateBaseDir, path.dirname(template));
      const templatePath = path.join(templateDir, templateName + templateExt);
      templateName = path
        .relative(templateBaseDir, templatePath)
        .replace(templateExt, '');

      if (!this.precompiledTemplates[templateName]) {
        try {
          const src = fs.readFileSync(templatePath, 'utf-8');
          this.precompiledTemplates[templateName] = handlebars.compile(
            src,
            get(options, 'options', {}) as Parameters<
              typeof handlebars.compile
            >[1],
          );
        } catch (err) {
          onErr(err as Error);
          return undefined;
        }
      }
      return {
        templateExt,
        templateName,
        templateDir,
        templatePath,
      };
    };

    const first = precompile(mail.data.template, callback, templateConfig);
    if (!first) return;

    const { templateName } = first;

    const runtimeOptions = get(mailerOptions, 'options', {
      partials: false,
      data: {},
    }) as {
      partials?: false | { dir: string };
      data?: Record<string, unknown>;
    };

    if (runtimeOptions.partials && typeof runtimeOptions.partials === 'object') {
      const partialOpts =
        runtimeOptions.partials as unknown as MailerOptions['template'];
      const partialPath = path
        .join(runtimeOptions.partials.dir, '**', '*.hbs')
        .replace(/\\/g, '/');
      const files = globSync(partialPath);
      for (const file of files) {
        const partialResult = precompile(file, () => undefined, partialOpts);
        if (!partialResult) continue;
        const { templateName: pName, templatePath: pPath } = partialResult;
        const relDir = path.relative(
          runtimeOptions.partials.dir,
          path.dirname(pPath),
        );
        handlebars.registerPartial(
          path.join(relDir, pName),
          fs.readFileSync(pPath, 'utf-8'),
        );
      }
    }

    try {
      const rendered = this.precompiledTemplates[templateName](
        mail.data.context,
        {
          ...runtimeOptions,
          partials: this.precompiledTemplates,
        } as handlebars.RuntimeOptions,
      );
      mail.data.html = rendered;
      callback();
    } catch (e) {
      callback(e as Error);
    }
  }
}
