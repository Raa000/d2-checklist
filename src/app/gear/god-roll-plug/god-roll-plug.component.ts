import { ChangeDetectionStrategy, Component, Input, ElementRef, ViewChild } from '@angular/core';
import { IconService } from '@app/service/icon.service';
import { InventoryPlug } from '@app/service/model';
import { NotificationService } from '@app/service/notification.service';
import { ClipboardService } from 'ngx-clipboard';
import { Overlay, OverlayRef, FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const ClarityStyles = {
  'background': 'background',
  'blue': 'blue',
  'bold': 'bold',
  'breakSpaces': 'breakSpaces',
  'center': 'center',
  'communityDescription': 'communityDescription',
  'descriptionDivider': 'descriptionDivider',
  'enhancedArrow': 'enhancedArrow',
  'green': 'green',
  'link': 'link',
  'purple': 'purple',
  'pve': 'pve',
  'pvp': 'pvp',
  'spacer': 'spacer',
  'title': 'title',
  'yellow': 'yellow'
};

/*
       (^|\b) : start from the beginning of the string or a word boundary
        [+-]? : include + or - prefixes
  (\d*\.)?\d+ : match numbers (including decimal values)
([xs]|ms|HP)? : optionally include 'x' multiplier, 's', 'ms' and 'HP' unit suffixes
      ?:[%°+] : optionally include %, ° and + suffixes
         \b|$ : stop at a word boundary or the end of the string
*/
const boldTextRegEx = /(^|\b)([+-]?(\d*\.)?\d+([xs]|ms|HP)?)(?:[%°+]|\b|$)/g;


interface TextSegment {
  type: 'text' | 'bold';
  content: string | SafeHtml;
}


/*
interface SegmentThing
{
  key? : number,
  text? : string,
  capturedText? : string
}

function applyFormatting(text: string | undefined) {
  if (text === undefined) {
    return;
  }
  // I will remove this later just need to make this arrow optional in compiler
  if (text === '🡅') {
    return '';
  }
  const segments: SegmentThing[] = [];

  const matches = [...text.matchAll(boldTextRegEx)];
  let startIndex = 0;
  let n = 0;
  for (const match of matches) {
    if (match.index === undefined) {
      continue;
    }
    const capturedText = match[0];

    segments.push({text: text.substring(startIndex, match.index)});
    segments.push({key: n++, capturedText : capturedText});
    startIndex = match.index + capturedText.length;
  }
  if (startIndex < text.length) {
    segments.push({text: text.substring(startIndex)});
  }

  return segments;
};
*/

// my-custom-tooltip.component.ts

@Component({
  selector: 'app-my-custom-tooltip',
  templateUrl: './../clarity-overlay/clarity-overlay.component.html',
  styleUrls: ['./god-roll-plug.component.scss']
})
export class MyCustomTooltipComponent 
{
  @Input() plugData: InventoryPlug; 

  segments : string[];

  constructor(private sanitizer: DomSanitizer) {

    // format the description?

  }

  joinClassNames(classNames?: (keyof typeof ClarityStyles)[])
  {
    return classNames?.map((className) => ClarityStyles[className]).join(' ');
  }
  
  applyFormatting(text: string): SafeHtml {
    const segments: TextSegment[] = [];
    let lastIndex = 0;

    const matches = [...text.matchAll(boldTextRegEx)];

    matches.forEach(match => {
      // Add the text before the match
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }

      // Add the bold text
      //segments.push({ type: 'bold', content: this.sanitizer.bypassSecurityTrustHtml('<b>' + match[0] + '</b>') });
      segments.push({ type: 'bold', content: '<b>' + match[0] + '</b>' });

      lastIndex = match.index + match[0].length;
    });

    // Add any remaining text after the last match
    if (lastIndex < text.length) {
      segments.push({ type: 'text', content: text.substring(lastIndex) });
    }

    // Combine the segments into a single string
    return this.sanitizer.bypassSecurityTrustHtml(segments.map(segment => {
      return segment.type === 'bold' ? segment.content : segment.content;
    }).join(''));
  }

}


// regular stuff

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'd2c-god-roll-plug',
  templateUrl: './god-roll-plug.component.html',
  styleUrls: ['./god-roll-plug.component.scss']
})
export class GodRollPlugComponent {

  @Input() plug: InventoryPlug;

  @Input() debugmode: boolean;
  
  @Input() currentLevel: number|null;

  @ViewChild('tooltipTrigger', { static: true }) tooltipTrigger: ElementRef;

  private overlayRef: OverlayRef;

  constructor(
    public iconService: IconService,
    private clipboardService: ClipboardService,
    private notificationService: NotificationService,
    private overlay: Overlay 
    //private renderer: Renderer2
    ) { }


  copyToClipboard() {
    this.clipboardService.copyFromContent(this.plug.hash);
    this.notificationService.success('Copied ' + this.plug.name + ' to clipboard');
  }

  showTooltip(origin: ElementRef, plugIn: InventoryPlug) {

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(origin)
      .withPositions([
        {
          originX: 'start',
          originY: 'center',
          overlayX: 'end',
          overlayY: 'center',
        },
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: false
    });

    const customTooltipPortal = new ComponentPortal(MyCustomTooltipComponent);
    const tooltipInstance = this.overlayRef.attach(customTooltipPortal);
    tooltipInstance.instance.plugData = plugIn;
  }

  hideTooltip() {
    if (this.overlayRef) {
      this.overlayRef.dispose();
    }
  }

}

