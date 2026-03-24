import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TipospagoComponent } from './tipospago.component';

describe('TipospagoComponent', () => {
  let component: TipospagoComponent;
  let fixture: ComponentFixture<TipospagoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TipospagoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TipospagoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
